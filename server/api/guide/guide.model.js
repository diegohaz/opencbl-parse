'use strict'

import mongoose, {Schema} from 'mongoose'
import mongooseKeywords from 'mongoose-keywords'
import _ from 'lodash'
import {getKeywords} from '../../services/watson'
import Tag from '../tag/tag.model'
import Challenge from '../challenge/challenge.model'

const GuideSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
  },
  challenge: {
    type: Schema.ObjectId,
    ref: 'Challenge',
    index: true
  },
  tags: [{
    type: Schema.ObjectId,
    ref: 'Tag'
  }],
  title: {
    type: String,
    required: true,
    maxlength: 96
  },
  description: {
    type: String,
    maxlength: 2048
  },
  guides: [{
    type: Schema.ObjectId,
    ref: 'Guide',
    index: true
  }]
}, {
  timestamps: true
})

GuideSchema.pre('save', function (next) {
  const taggablePaths = this.constructor.getTaggablePaths()
  const modified = taggablePaths.map((path) => this.isModified(path)).find(_.identity)

  if (modified) {
    this.assignTags().then(() => next()).catch(next)
  } else {
    next()
  }
})

GuideSchema.pre('remove', function (next) {
  const Guide = this.model('Guide')
  return Challenge.update({guides: this}, {$pull: {guides: this._id}}, {multi: true})
    .then(() => Guide.update({guides: this}, {$pull: {guides: this._id}}, {multi: true}))
    .then(() => next())
    .catch(next)
})

GuideSchema.methods = {
  view () {
    const {user, tags, challenge, guides} = this
    const omittedPaths = ['_id', '__v', '__t', 'user', 'tags', 'challenge', 'guides']
    return {
      ..._.omit(this.toObject({virtuals: true}), omittedPaths),
      user: user ? user.view() : undefined,
      tags: tags ? tags.map((tag) => tag.view()) : undefined,
      challenge: challenge ? challenge.view() : undefined,
      guides: guides ? guides.map((guide) => guide.view()) : undefined
    }
  },

  assignTags () {
    return Tag.increment(this.tags, -1)
      .then(() => this.fetchTags())
      .then((tags) => Tag.createUnique(tags.map((name) => ({name}))))
      .tap((tags) => { this.tags = tags })
      .then((tags) => Tag.increment(tags))
  },

  fetchTags () {
    const paths = this.constructor.getTaggablePaths()
    return getKeywords(paths.map((path) => this[path]).join('\n\n'))
  }
}

GuideSchema.statics = {
  getTaggablePaths () {
    return ['title', 'description']
  }
}

GuideSchema.plugin(mongooseKeywords, {paths: ['title', 'tags']})

export default mongoose.model('Guide', GuideSchema)
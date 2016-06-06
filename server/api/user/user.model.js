'use strict'

import bcrypt from 'bcrypt'
import randtoken from 'rand-token'
import mongoose, {Schema} from 'mongoose'
import mongooseKeywords from 'mongoose-keywords'
import {env} from '../../config'
import Session from '../session/session.model'

const compare = require('bluebird').promisify(bcrypt.compare)
const roles = ['user', 'admin']

const UserSchema = new Schema({
  email: {
    type: String,
    match: /^\S+@\S+\.\S+$/,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    index: true,
    trim: true
  },
  role: {
    type: String,
    enum: roles,
    default: 'user'
  },
  pictureUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})

UserSchema.path('email').set(function (email) {
  if (email === 'anonymous') {
    return randtoken.generate(16) + '@anonymous.com'
  } else {
    return email
  }
})

UserSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next()

  let rounds = env === 'test' ? 1 : 9

  bcrypt.hash(this.password, rounds, (err, hash) => {
    if (err) return next(err)
    this.password = hash
    next()
  })
})

UserSchema.post('remove', function (user) {
  if (env === 'test') return
  /* istanbul ignore next */
  user.postRemove()
})

UserSchema.methods.postRemove = function () {
  return Session.find({user: this}).exec().map(session => session.remove())
}

UserSchema.methods.view = function (full) {
  let view = {}
  let fields = ['id', 'name', 'pictureUrl']

  if (full) {
    fields = [...fields, 'email', 'createdAt']
  }

  fields.forEach(field => { view[field] = this[field] })

  return view
}

UserSchema.methods.authenticate = function (password) {
  return compare(password, this.password).then(valid => valid ? this : false)
}

UserSchema.statics.roles = roles

UserSchema.plugin(mongooseKeywords, {paths: ['email', 'name']})

export default mongoose.model('User', UserSchema)
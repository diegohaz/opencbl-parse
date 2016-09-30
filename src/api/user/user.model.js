import crypto from 'crypto'
import bcrypt from 'bcrypt'
import randtoken from 'rand-token'
import mongoose, { Schema } from 'mongoose'
import mongooseKeywords from 'mongoose-keywords'
import { env } from '../../config'

const compare = require('bluebird').promisify(bcrypt.compare)
const roles = ['user', 'admin']

const UserSchema = new Schema({
  email: {
    type: String,
    match: /^\S+@\S+\.\S+$/,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    index: true,
    trim: true
  },
  facebook: {
    id: String
  },
  role: {
    type: String,
    enum: roles,
    default: 'user'
  },
  picture: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})

UserSchema.path('email').set(function (email) {
  if (!this.picture || this.picture.indexOf('https://gravatar.com') === 0) {
    const hash = crypto.createHash('md5').update(email).digest('hex')
    this.picture = `https://gravatar.com/avatar/${hash}?d=identicon`
  }

  if (!this.name) {
    this.name = email.replace(/^(.+)@.+$/, '$1')
  }

  return email
})

UserSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next()

  /* istanbul ignore next */
  const rounds = env === 'test' ? 1 : 9

  bcrypt.hash(this.password, rounds, (err, hash) => {
    /* istanbul ignore next */
    if (err) return next(err)
    this.password = hash
    next()
  })
})

UserSchema.methods = {
  view (full) {
    let view = {}
    let fields = ['id', 'name', 'picture']

    if (full) {
      fields = [...fields, 'email', 'createdAt']
    }

    fields.forEach((field) => { view[field] = this[field] })

    return view
  },

  authenticate (password) {
    return compare(password, this.password).then((valid) => valid ? this : false)
  }
}

UserSchema.statics = {
  roles,

  createFromFacebook ({ id, name, email, picture }) {
    return this.findOne({ $or: [{ 'facebook.id': id }, { email }] }).then((user) => {
      if (user) {
        user.facebook.id = id
        user.name = name
        user.picture = picture.data.url
        return user.save()
      } else {
        const password = randtoken.generate(16)
        return this.create({
          name,
          email,
          password,
          facebook: { id },
          picture: picture && picture.data && picture.data.url
        })
      }
    })
  }
}

UserSchema.plugin(mongooseKeywords, { paths: ['email', 'name'] })

export default mongoose.model('User', UserSchema)
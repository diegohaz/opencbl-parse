'use strict'

import _ from 'lodash'
import { success, error, notFound } from '../../services/response/'
import Activity from './activity.model'

export const index = ({ querymen: { query, select, cursor } }, res) =>
  Activity.find(query, select, cursor)
    .populate('user tags challenge')
    .then((guides) => guides.map((guide) => guide.view()))
    .then(success(res))
    .catch(error(res))

export const show = ({ params }, res) =>
  Activity.findById(params.id)
    .populate('user tags challenge guides')
    .then(notFound(res))
    .then((guide) => guide ? guide.view() : null)
    .then(success(res))
    .catch(error(res))

export const create = ({ body, user }, res) => {
  body.user = user
  return Activity.create(body)
    .then((guide) => guide.view())
    .then(success(res, 201))
    .catch(error(res))
}

export const update = ({ body, params, user }, res) => {
  const omittedPaths = ['_id', 'user', 'challenge']
  return Activity.findById(params.id)
    .then(notFound(res))
    .then((guide) => {
      if (!guide) return null
      const isAdmin = user.role === 'admin'
      const isSameUser = guide.user.equals(user.id)
      if (!isSameUser && !isAdmin) {
        res.status(401).end()
        return null
      }
      return guide
    })
    .then((guide) => guide ? _.assign(guide, _.omit(body, omittedPaths)).save() : null)
    .then((guide) => guide ? guide.view() : null)
    .then(success(res))
    .catch(error(res))
}

export const destroy = ({ params, user }, res) =>
  Activity.findById(params.id)
    .then(notFound(res))
    .then((guide) => {
      if (!guide) return guide
      const isAdmin = user.role === 'admin'
      const isSameUser = guide.user.equals(user.id)
      if (!isSameUser && !isAdmin) {
        res.status(401).end()
      } else {
        return guide
      }
    })
    .then((guide) => guide ? guide.remove() : null)
    .then(success(res, 204))
    .catch(error(res))

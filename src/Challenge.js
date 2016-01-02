import User from './User';
import Photo from './Photo';
import Contribution from './Contribution';
import Question from './Question';
import Activity from './Activity';
import Resource from './Resource';
import Tag from './Tag';
import Keyword from './Keyword';

import _ from 'underscore';
import clean from 'underscore.string/clean';
import cleanDiacritics from 'underscore.string/cleanDiacritics';

export default class Challenge extends Parse.Object {
  constructor(attributes, options) {
    super('Challenge', attributes, options);

    this.indexes = ['title', 'description', 'bigIdea', 'essentialQuestion'];
    this.photos = [];
  }

  // schematize
  schematize() {
    this.get('user')              || this.set('user', User.current());
    // this.get('photo')          || this.set('photo', Photo);
    this.get('title')             || this.set('title', '');
    this.get('description')       || this.set('description', '');
    this.get('bigIdea')           || this.set('bigIdea', '');
    this.get('essentialQuestion') || this.set('essentialQuestion', '');
    this.get('keywords')          || this.set('keywords', []);
    this.get('contributors')      || this.set('contributors', []);
    this.get('questions')         || this.set('questions', []);
    this.get('activities')        || this.set('activities', []);
    this.get('resources')         || this.set('resources', []);

    let acl = new Parse.ACL(this.get('user'));
    acl.setPublicReadAccess(true);

    this.setACL(acl);
  }

  // view
  view() {
    if (!this.createdAt) return;

    let view = {};

    view.id = this.id;
    view.user = this.get('user')? this.get('user').view() : undefined;
    view.photo = this.get('photo')? this.get('photo').view() : undefined;
    view.title = this.get('title');
    view.description = this.get('description');
    view.bigIdea = this.get('bigIdea');
    view.essentialQuestion = this.get('essentialQuestion');
    view.keywords = this.get('keywords');

    let lists = ['contributors', 'questions', 'activities', 'resources'];

    lists.forEach(list => {
      if (this.get(list).length && this.get(list)[0].createdAt) {
        view[list] = this.get(list).map(a => a.view());
      } else if (this.get(list)) {
        view[list] = this.get(list).length;
      }
    });

    return view;
  }

  // get
  static get(id) {
    let challenge = new Parse.Query(this);

    challenge.include([
      'user', 'contributors', 'contributors.user',
      'questions', 'activities', 'resources', 'photo'
    ]);

    return challenge.get(id).then(c => {
      return c? Parse.Promise.as(c.view()) : Parse.Promise.error();
    });
  }

  // list
  static list({
    user, contributor, keywords,
    orderBy = 'updatedAt',
    order = 'descending',
    limit = 30,
    page = 0
  } = {}) {
    let challenges = new Parse.Query(this);

    // constraints
    user        && challenges.equalTo('user', user);
    contributor && challenges.equalTo('contributors', contributor);

    if (keywords) {
      keywords = keywords.map(k => cleanDiacritics(k.toLowerCase()));
      challenges.containedIn('keywords', keywords);
    }

    challenges.include(['user', 'photo']);
    challenges[order](orderBy);
    challenges.limit(limit);
    challenges.skip(limit * page);

    return challenges.find().then(challenges => {
      return Parse.Promise.as(challenges.map(c => c.view()));
    });
  }

  // beforeSave
  static beforeSave(request, response) {
    let challenge = request.object;
    let promise = Parse.Promise.as();

    if (!challenge.get('title')) return response.error('Empty title');

    if (_.find(challenge.dirtyKeys(), k => ~challenge.indexes.indexOf(k))) {
      challenge.set('title', clean(challenge.get('title')));
      challenge.set('description', clean(challenge.get('description')));
      challenge.set('bigIdea', clean(challenge.get('bigIdea')));
      challenge.set('essentialQuestion', clean(challenge.get('essentialQuestion')));

      let text = challenge.indexes.map(k => challenge.get(k)).join('\n');

      promise = Keyword.extract(text).then(keywords => {
        challenge.set('keywords', keywords);
      });
    }

    if (!challenge.get('photo')) {
      promise = promise.always(() => {
        return Photo.search({keywords: challenge.get('keywords'), limit: 1, pointers: true});
      }).then(photos => {
        if (photos.length) {
          challenge.set('photo', photos[0]);
        } else {
          console.log('No photos');
          console.log(challenge.get('keywords'));
        }
      }, error => {
        console.log(error);
      });
    }

    promise.always(() => {
      challenge.schematize();
      response.success();
    });
  }

  // afterSave
  static afterSave(request) {
    let challenge = request.object;

    if (!challenge.get('keywords').length) {
    }
  }

  // beforeDelete
  static beforeDelete(request, response) {
    Parse.Cloud.useMasterKey();

    let challenge = request.object;

    Contribution.cleanUp('challenge', challenge)
      .always(() => Tag.cleanUp('challenge', challenge))
      .always(() => Question.cleanUp('challenge', challenge))
      .always(() => Activity.cleanUp('challenge', challenge))
      .always(() => Resource.cleanUp('challenge', challenge))
      .always(() => response.success());
  }

  // cleanUp
  static cleanUp(attribute, value) {
    Parse.Cloud.useMasterKey();

    let challenges = new Parse.Query(Challenge);
    let runAgain = false;

    challenges.equalTo(attribute, value);
    challenges.limit(1000);

    return challenges.find().then(challenges => {
      runAgain = challenges.length == 1000;

      if (attribute == 'user') {
        challenges.forEach(d => d.unset('user'));
      } else {
        challenges.forEach(d => d.remove(attribute, value));
      }

      return Parse.Object.saveAll(challenges);
    }).then(() => {
      if (runAgain) {
        return Challenge.cleanUp(attribute, value);
      } else {
        return Parse.Promise.as();
      }
    });
  }
}

Parse.Object.registerSubclass('Challenge', Challenge);

Parse.Cloud.beforeSave('Challenge', Challenge.beforeSave);
Parse.Cloud.afterSave('Challenge', Challenge.afterSave);
Parse.Cloud.beforeDelete('Challenge', Challenge.beforeDelete);

Parse.Cloud.define('getChallenge', (request, response) => {
  Challenge.get(request.params.id).then(response.success, response.error);
});

Parse.Cloud.define('listChallenges', (request, response) => {
  Challenge.list(request.params).then(response.success, response.error);
});
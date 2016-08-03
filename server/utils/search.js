let Collection = require('../models/Collection')

module.exports = function search(schema, searchString, sort, limit, offset) {
  let sortOption = {
    score: { $meta:'textScore' },
    when: 1
  }
  if(sort == 'relevance') {
    sortOption = {
      score: { $meta:'textScore' }
    }
  } else if(sort == 'latest') {
    sortOption = {
      when: -1
    }
  } else if(sort == 'earliest') {
    sortOption = {
      when: 1
    }
  }
  
  return schema.find({
    $text: { $search: searchString }
  }, {
    score: { $meta: 'textScore' }
  }).sort(sortOption)
    .skip(offset || 0)
    .limit(limit || 10)
}

module.exports.inCollection = function(cid, searchString, sort, limit, offset) {
  // idk if it works
  return Collection.find({_id: cid}).populate({
    path: 'items.item',
    select: {
      name: 1,
      audio: 1,
      image: 1,
      script: 1,
      deleted: 1,
      _id: 1,
      owners: 1,
      when: 1,
      data: 1,
      type: 1
    }
  }, {
    $text: { $search: searchString }
  }, {
    score: { $meta: 'textScore' }
  })
}
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

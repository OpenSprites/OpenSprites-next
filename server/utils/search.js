module.exports = function search(schema, searchString, limit, offset) {
  return schema.find({
    $text: { $search: searchString }
  }, {
    score: { $meta: 'textScore' }
  }).sort({
    score: { $meta:'textScore' },
    when: 1
  })
    .skip(offset || 0)
    .limit(limit || 10)
}

module.exports = function search(schema, searchString, limit, offset) {
  return schema.find({
      $text: {$search: searchString}})
    .skip(offset || 0)
    .limit(limit || 10)
}
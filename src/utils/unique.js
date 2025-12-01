/**
 * 根据指定字段对对象数组进行去重
 * @param {Array} arr 要去重的对象数组
 * @param {string} key 去重依据的字段名
 * @returns {Array} 去重后的对象数组
 */
function uniqueByField(arr, key) {
  const seen = new Map()
  return arr.filter((item) => {
    const value = item[key]
    return seen.has(value) ? false : (seen.set(value, item), true)
  })
}

export { uniqueByField }

// 默认配置
const DEFAULT_CONFIG = {
  id: 'id',
  children: 'children',
  pid: 'pid'
}

// 获取配置。  Object.assign 从一个或多个源对象复制到目标对象
const getConfig = (config) => Object.assign({}, DEFAULT_CONFIG, config)

// tree from list
// 列表中的树
export function listToTree(list, config) {
  const conf = getConfig(config)
  const nodeMap = new Map()
  const result = []
  const { id, children, pid } = conf

  for (const node of list) {
    node[children] = node[children] || []
    nodeMap.set(node[id], node)
  }
  for (const node of list) {
    const parent = nodeMap.get(node[pid])
    ;(parent ? parent[children] : result).push(node)
  }
  return result
}

export function treeToList(tree, config) {
  config = getConfig(config)
  const { children } = config
  const result = [...tree]
  for (let i = 0; i < result.length; i++) {
    if (!result[i][children]) continue
    result.splice(i + 1, 0, ...result[i][children])
  }
  return result
}

export function findNode(tree, func, config) {
  config = getConfig(config)
  const { children } = config
  const list = [...tree]
  for (const node of list) {
    if (func(node)) return node
    node[children] && list.push(...node[children])
  }
  return null
}

export function findNodeAll(tree, func, config) {
  config = getConfig(config)
  const { children } = config
  const list = [...tree]
  const result = []
  for (const node of list) {
    func(node) && result.push(node)
    node[children] && list.push(...node[children])
  }
  return result
}

export function findPath(tree, func, config) {
  config = getConfig(config)
  const path = []
  const list = [...tree]
  const visitedSet = new Set()
  const { children } = config
  while (list.length) {
    const node = list[0]
    if (visitedSet.has(node)) {
      path.pop()
      list.shift()
    } else {
      visitedSet.add(node)
      node[children] && list.unshift(...node[children])
      path.push(node)
      if (func(node)) {
        return path
      }
    }
  }
  return null
}

export function findPathAll(tree, func, config) {
  config = getConfig(config)
  const path = []
  const list = [...tree]
  const result = []
  const visitedSet = new Set(),
    { children } = config
  while (list.length) {
    const node = list[0]
    if (visitedSet.has(node)) {
      path.pop()
      list.shift()
    } else {
      visitedSet.add(node)
      node[children] && list.unshift(...node[children])
      path.push(node)
      func(node) && result.push([...path])
    }
  }
  return result
}

export function filter(tree, func, config) {
  // 获取配置
  config = getConfig(config)
  const { children } = config

  function listFilter(list) {
    return list
      .map((node) => ({ ...node }))
      .filter((node) => {
        // 递归调用 对含有children项  进行再次调用自身函数 listFilter
        node[children] = node[children] && listFilter(node[children])
        // 执行传入的回调 func 进行过滤
        return func(node) || (node[children] && node[children].length)
      })
  }

  return listFilter(tree)
}

export function forEach(tree, func, config) {
  config = getConfig(config)
  const list = [...tree]
  const { children } = config
  for (let i = 0; i < list.length; i++) {
    //func 返回true就终止遍历，避免大量节点场景下无意义循环，引起浏览器卡顿
    if (func(list[i])) {
      return
    }
    children && list[i][children] && list.splice(i + 1, 0, ...list[i][children])
  }
}

/**
 * @description: Extract tree specified structure
 * @description: 提取树指定结构
 */
export function treeMap(treeData, opt) {
  return treeData.map((item) => treeMapEach(item, opt))
}

/**
 * @description: Extract tree specified structure
 * @description: 提取树指定结构
 */
export function treeMapEach(data, { children = 'children', conversion }) {
  const haveChildren =
    Array.isArray(data[children]) && data[children].length > 0
  const conversionData = conversion(data) || {}
  if (haveChildren) {
    return {
      ...conversionData,
      [children]: data[children].map((i) =>
        treeMapEach(i, {
          children,
          conversion
        })
      )
    }
  } else {
    return {
      ...conversionData
    }
  }
}

/**
 * 递归遍历树结构
 * @param treeDatas 树
 * @param callBack 回调
 * @param parentNode 父节点
 */
export function eachTree(treeDatas, callBack, parentNode = {}) {
  treeDatas.forEach((element) => {
    const newNode = callBack(element, parentNode) || element
    if (element.children) {
      eachTree(element.children, callBack, newNode)
    }
  })
}

/**
 * 遍历树形结构，并返回所有节点中指定的值。
 * @param tree 树形结构数组
 * @param getValue 获取节点值的函数
 * @param options 作为子节点数组的可选属性名称。
 * @returns 所有节点中指定的值的数组
 */
export function traverseTreeValues(tree, getValue, options) {
  const result = []

  const { childProps } = options || {
    childProps: 'children',
  }

  const dfs = (treeNode) => {
    const value = getValue(treeNode)
    result.push(value)
    const children = treeNode?.[childProps]
    if (!children) {
      return
    }
    if (children.length > 0) {
      for (const child of children) {
        dfs(child)
      }
    }
  }

  for (const treeNode of tree) {
    dfs(treeNode)
  }
  return result.filter(Boolean)
}

/**
 * 根据条件重新映射给定树结构的节
 * @param tree 要过滤的树结构的根节点数组。
 * @param mapper 用于map每个节点的条件。
 * @param options 作为子节点数组的可选属性名称。
 */
export function mapTree(tree, mapper, options) {
  const { childProps } = options || {
    childProps: 'children',
  }
  return tree.map((node) => {
    const mapperNode = mapper(node)
    if (mapperNode[childProps]) {
      mapperNode[childProps] = mapTree(mapperNode[childProps], mapper, options)
    }
    return mapperNode
  })
}


/**
 * 根据条件过滤给定树结构的节点，并以原有顺序返回所有匹配节点的数组。
 * @param tree 要过滤的树结构的根节点数组。
 * @param filter 用于匹配每个节点的条件。
 * @param options 作为子节点数组的可选属性名称。
 * @returns array 包含所有匹配节点的数组。
 */
export function filterTree(tree, filter, options) {
  const { childProps } = options || {
    childProps: 'children',
  }

  const _filterTree = (nodes) => {
    return nodes.filter((node) => {
      if (filter(node)) {
        if (node[childProps]) {
          node[childProps] = _filterTree(node[childProps])
        }
        return true
      }
      return false
    })
  }

  return _filterTree(tree)
}

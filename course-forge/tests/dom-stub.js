/**
 * The smallest DOM the exported player needs to boot.
 *
 * Enough to run the real player source in Node and assert on what it
 * rendered, without pulling in a browser or a DOM library for one test.
 */
export function createElement(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attributes: {},
    listeners: {},
    style: {},
    className: '',
    hidden: false,
    disabled: false,
    _text: '',
    appendChild(child) {
      node.children.push(child)
      return child
    },
    setAttribute(name, value) {
      node.attributes[name] = String(value)
    },
    getAttribute(name) {
      return node.attributes[name] ?? null
    },
    addEventListener(name, handler) {
      ;(node.listeners[name] ??= []).push(handler)
    },
    scrollIntoView() {},
    click() {
      for (const handler of node.listeners.click ?? []) handler({})
    },
  }

  Object.defineProperty(node, 'textContent', {
    get: () => (node.children.length ? node.children.map((child) => child.textContent).join('') : node._text),
    // Assigning textContent clears children, as it does in a browser — the
    // player relies on that to re-render the sidebar.
    set: (value) => {
      node.children = []
      node._text = String(value)
    },
  })

  return node
}

export function createDom() {
  const sidebar = createElement('aside')
  const main = createElement('main')
  const byId = { sidebar, main }

  const document = {
    createElement,
    getElementById: (id) => byId[id] ?? null,
    addEventListener() {},
  }

  return { document, sidebar, main }
}

/** Every node in the tree, so a test can look for what was rendered. */
export function flatten(node) {
  return [node, ...node.children.flatMap(flatten)]
}

export function findAll(root, className) {
  return flatten(root).filter((node) => String(node.className).split(' ').includes(className))
}

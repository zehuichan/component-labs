import { ElTooltip } from 'element-plus'
import { merge } from 'es-toolkit'
import { createVNode, render } from 'vue'

export let removePopper = null

const getOverflowTooltipProps = (props, content) => {
  return {
    content,
    ...props,
    popperOptions: {
      strategy: 'fixed',
      ...props.popperOptions,
    },
  }
}

export function createPopper(props, popperContent, trigger, instance) {
  if (removePopper?.trigger === trigger) {
    merge(
      removePopper.vm.component.props,
      getOverflowTooltipProps(props, popperContent)
    )
    return
  }
  removePopper?.()
  const parentNode = instance?.proxy.$el
  const vm = createVNode(ElTooltip, {
    virtualTriggering: true,
    virtualRef: trigger,
    appendTo: parentNode,
    placement: 'top',
    transition: 'none', // Default does not require transition
    offset: 0,
    hideAfter: 0,
    ...getOverflowTooltipProps(props, popperContent),
  })
  vm.appContext = { ...instance.appContext, ...instance }
  const container = document.createElement('div')
  render(vm, container)
  vm.component.exposed.onOpen()
  const scrollContainer = parentNode?.querySelector(`.el-scrollbar__wrap`)
  removePopper = () => {
    render(null, container)
    scrollContainer?.removeEventListener('scroll', removePopper)
    removePopper = null
  }
  removePopper.trigger = trigger
  removePopper.vm = vm
  scrollContainer?.addEventListener('scroll', removePopper)
}


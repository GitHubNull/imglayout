import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Slider from 'primevue/slider'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import ToggleButton from 'primevue/togglebutton'
import App from './App.vue'
import './style.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
// dev 下调试验收钩子（生产构建不含）
if (import.meta.env.DEV) {
  ;(window as unknown as { __pinia: typeof pinia }).__pinia = pinia
}
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
})

app.component('Button', Button)
app.component('ColorPicker', ColorPicker)
app.component('Dialog', Dialog)
app.component('IconField', IconField)
app.component('InputIcon', InputIcon)
app.component('InputNumber', InputNumber)
app.component('InputText', InputText)
app.component('ProgressBar', ProgressBar)
app.component('Select', Select)
app.component('SelectButton', SelectButton)
app.component('Slider', Slider)
app.component('Tab', Tab)
app.component('TabList', TabList)
app.component('TabPanel', TabPanel)
app.component('TabPanels', TabPanels)
app.component('Tabs', Tabs)
app.component('ToggleButton', ToggleButton)

app.mount('#app')

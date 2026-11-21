import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Slider from 'primevue/slider'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(createPinia())
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
app.component('InputNumber', InputNumber)
app.component('ProgressBar', ProgressBar)
app.component('Select', Select)
app.component('SelectButton', SelectButton)
app.component('Slider', Slider)
app.component('Tab', Tab)
app.component('TabList', TabList)
app.component('TabPanel', TabPanel)
app.component('TabPanels', TabPanels)
app.component('Tabs', Tabs)

app.mount('#app')

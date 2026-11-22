<script setup lang="ts">
// 版本与更新历史经 virtual:app-info 构建期注入（值来自仓库根 package.json / CHANGELOG.md，见 vite.config.ts）
import { computed } from 'vue'
import { APP_CHANGELOG, APP_VERSION } from 'virtual:app-info'
import { renderMarkdownLite } from '../../lib/help/markdown'

const visible = defineModel<boolean>({ required: true })

const changelogHtml = computed(() => renderMarkdownLite(APP_CHANGELOG))

const MIT_TEXT = `MIT License

Copyright (c) 2026 GitHubNull

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
</script>

<template>
  <Dialog v-model:visible="visible" header="关于 imgLayout" :modal="true" :style="{ width: '560px' }">
    <div class="about-body">
      <div class="about-brand">
        <img src="/favicon.svg" alt="" class="about-icon" />
        <div>
          <div class="about-name">imgLayout 照片拼接打印工具</div>
          <div class="about-meta">版本 v{{ APP_VERSION }} · 作者 GitHubNull</div>
        </div>
      </div>

      <section>
        <h4>开源协议（MIT）</h4>
        <p class="about-note">本软件以 MIT 协议开源：可自由使用、复制、修改与分发，无任何担保。完整条款如下。</p>
        <pre class="about-pre">{{ MIT_TEXT }}</pre>
      </section>

      <section>
        <h4>更新历史</h4>
        <div class="about-pre about-changelog md" v-html="changelogHtml" />
      </section>
    </div>
    <template #footer>
      <Button label="关闭" @click="visible = false" />
    </template>
  </Dialog>
</template>

<style scoped>
.about-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.about-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.about-icon {
  width: 40px;
  height: 40px;
}
.about-name {
  font-size: 15px;
  font-weight: 600;
}
.about-meta {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.about-body h4 {
  margin: 0 0 6px;
  font-size: 13px;
}
.about-note {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.about-pre {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  background: var(--p-content-hover-background);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow: auto;
}
.about-changelog {
  max-height: 220px;
}
.md h1,
.md h2,
.md h3 {
  margin: 10px 0 4px;
  font-size: 12px;
}
.md h1:first-child,
.md h2:first-child,
.md h3:first-child {
  margin-top: 0;
}
.md h1 {
  font-size: 14px;
}
.md ul {
  margin: 4px 0;
  padding-left: 18px;
}
.md li {
  margin: 2px 0;
}
.md p {
  margin: 4px 0;
}
.md a {
  color: var(--p-primary-color);
}
.md code {
  font-family: monospace;
  font-size: 10px;
  background: var(--p-content-background);
  padding: 0 3px;
  border-radius: 3px;
}
</style>

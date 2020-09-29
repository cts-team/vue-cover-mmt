# vue-cover-mmt

## 介绍
一个vue-cli扩展包，扩展vue-cli支持模块、布局并支持自动发现并注册插件、状态管理、多语言、中间件、svg图标

## 安装
 `yarn add vue-cover-mmt`

## 使用说明

1.  修改`public`目录下`index.html`文件挂载点`<div id="app"></div>`为`<div id="__cover"></div>`
2.  在`src`文件夹下`router`文件夹创建路由文件`index.js`并**按需**添加路由配置
    ~~~~
    import Home from "../views/Home.vue";
    
    const routes = [
      {
        path: "/",
        name: "Home",
        component: Home
      },
      {
        path: "/about",
        name: "About",
        component: () =>
          import(/* webpackChunkName: "about" */ "../views/About.vue"),
        meta: {
          title: "关于"
        }
      },
      {
        path: "/login",
        name: "Login",
        component: () => import("../views/login")
      }
    ];
    
    export default routes;
    ~~~~
    
2.  在`src`目录下创建`config.js`文件，并添加以下代码：
    ~~~~
    import routes from "@/router"; //导入路由配置
    
    export const cover = {
        //modulesDir = '', 默认为'modules'
        //layoutsDir = '', 默认为'layouts'
        //middlewaresDir = '', 默认为'middlewares'
        //storeDir = ''; 默认为'store'
        //pluginsDir = ''; 默认为'plugins'
        //localesDir = ''; 默认为'locales'
        //autoLoadSvg = true; 默认为true
    };
    
    export const router = {
      routes
    };
    
    export const i18n = {
        ...VueI18n配置
    };

    export default { router, i18n, cover };
    ~~~~
4.  修改`src`文件夹下`main.js`为以下代码：
    ~~~~
    import config from "@/config";
    
    import { runCover } from "vue-cover-mmt";
    
    runCover(config);
    ~~~~

## 布局
   你可以扩展默认的布局，或在 layouts 目录下创建自定义任意数量的布局。
#### 默认布局
   可通过添加 `layouts/default.vue` 文件来扩展应用的默认布局。
   ~~~~
   提示: 别忘了在布局文件中添加 <cover /> 组件用于显示页面的主体内容。
   ~~~~        
   示例的布局源码如下：
   ~~~~
   <template>
     <cover />
   </template>
   ~~~~
#### 自定义布局

layouts 目录中的每个文件 (顶级) 都将创建一个可通过页面组件中的 layout 属性访问的自定义布局。
 假设我们要创建一个 博客布局 并将其保存到layouts/blog.vue:
~~~
<template>
  <div>
    <div>我的博客导航栏在这里</div>
    <cover/>
  </div>
</template>
~~~
然后我们必须告诉页面 (即`pages/posts.vue`) 使用您的自定义布局：

~~~
<template>
  <!-- Your template -->
</template>
<script>
  export default {
    layout: 'blog'
    // page component definitions
  }
</script>
~~~
### 状态管理
   在`src`文件夹下创建`store`文件夹并创建`index.js`文件，然后添加以下代码：
   ~~~~
    export const state = () => ({
      count: 0
    });
    export const getters = {
      count: state => state.authToken
    };
    export const mutations = {
      setCount(state, count) {
        state.count = count;
      }
    };
    export const actions = {
      setCount({ commit }, count) {
        commit("setCount", count);
      }
    };
   ~~~~
`   注意：您可以在src的store文件夹下添加任意数量的store文件，如果您使用了modules，在modules下
    store文件夹里的store文件也将被自动发现并注册，使用示例this.$store.getters['@app/me/myAge']`
    即为`src->modules->app->store->me`文件


## 插件（plugins）

将内容注入 Vue 实例，避免重复引入，在 Vue 原型上挂载注入一个函数，所有组件内都可以访问。

`plugins/vue-inject.js`:

~~~
import Vue from 'vue'

Vue.prototype.$myInjectedFunction = string =>
  console.log('This is an example', string)
~~~
或
~~~
export default ({ app }, inject) => {
  inject('myInjectedFunction', string => console.log('That was easy!', string))
}
~~~
该插件将被自动发现并注册，而后，你就可以在所有 Vue 组件中使用该函数。

`example-component.vue`:

~~~
export default {
  mounted() {
    this.$myInjectedFunction('test')
  }
}
~~~
`store/index.js`:

~~~
export const state = () => ({
  someValue: ''
})

export const mutations = {
  changeSomeValue(state, newValue) {
    this.$myInjectedFunction('accessible in mutations')
    state.someValue = newValue
  }
}

export const actions = {
  setSomeValueToWhatever({ commit }) {
    this.$myInjectedFunction('accessible in actions')
    const newValue = 'whatever'
    commit('changeSomeValue', newValue)
  }
}
~~~
注意：modules文件夹下的插件也将被自动发现

##   中间件

> 中间件允许您定义一个自定义函数运行在一个页面或一组页面渲染之前。

每一个中间件应放置在`middlewares/`目录，该中间件将被自动发现并注册。文件名的名称将成为中间件名称 (`middlewares/auth.js`将成为`auth`中间件)。

一个中间件接收context作为第一个参数：

~~~
export default function (context) {
}
~~~

中间件执行流程顺序：

1.  匹配布局
2.  匹配页面

中间件可以异步执行,只需要返回一个`Promise`或使用第 2 个`callback`作为第一个参数：

`middlewares/stats.js`

~~~
import axios from 'axios'

export default function ({ route }) {
  return axios.post('http://my-stats-api.com', {
    url: route.fullPath
  })
}

~~~

现在，`stats`中间件将在每个路由改变时被调用。

您也可以将 middleware 添加到指定的布局或者页面:

`pages/index.vue`或者`layouts/default.vue`

~~~
export default {
  middleware: 'stats'
}
~~~
注意：modules文件夹下的中间件也将被自动发现

## 多语言
 > 使用vue-i18n，src的locales目录、modules下的locales目录都将被自动发现并注册

在locales目录下创建zh_CN.js
~~~
export default {
  china: "中国"
}
~~~
modules下locales文件夹将以模块名称作为前缀，使用：`{{ $t('@app.china') }}`

## svg图标加载
将自动加载src与模块`assets/icons/svg`目录下的svg图标文件
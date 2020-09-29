<template>
  <div class="__cover-error-page">
    <div class="error">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="90"
        height="90"
        fill="#DBE1EC"
        viewBox="0 0 48 48"
      >
        <path
          d="M22 30h4v4h-4zm0-16h4v12h-4zm1.99-10C12.94 4 4 12.95 4 24s8.94 20 19.99 20S44 35.05 44 24 35.04 4 23.99 4zM24 40c-8.84 0-16-7.16-16-16S15.16 8 24 8s16 7.16 16 16-7.16 16-16 16z"
        />
      </svg>

      <div class="title">{{ $t(message) }}</div>

      <p v-if="statusCode === 404" class="description">
        <CoverLink class="error-link" to="/">{{ $t("backHome") }}</CoverLink>
      </p>

      <p class="description" v-else>
        {{ $t("errorOccurred") }}
      </p>
    </div>
  </div>
</template>

<script>
export default {
  name: "CoverError",
  props: {
    error: {
      type: Object,
      default: null
    }
  },
  computed: {
    statusCode() {
      return (this.error && this.error.statusCode) || 500;
    },
    message() {
      return this.error.message || "Error";
    }
  },
  head() {
    return {
      title: this.message,
      meta: [
        {
          name: "viewport",
          content: "width=device-width,initial-scale=1.0,minimum-scale=1.0"
        }
      ]
    };
  },
  i18n: {
    messages: {
      en: {
        backHome: "Back to the home page",
        errorOccurred:
          "An error occurred while rendering the page. Check developer tools console for details."
      },
      zh_CN: {
        backHome: "返回主页",
        "This page could not be found": "页面不存在",
        errorOccurred: "页面渲染出错。有关详细信息，请查看开发人员工具控制台"
      },
      zh_TW: {
        backHome: "返回主頁",
        "This page could not be found": "頁面不存在",
        errorOccurred: "頁面渲染出錯。有關詳細資訊，請查看開發人員工具控制台。"
      }
    }
  }
};
</script>

<style>
.__cover-error-page {
  padding: 1rem;
  background: #f7f8fb;
  color: #47494e;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-family: sans-serif;
  font-weight: 100 !important;
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.__cover-error-page .error {
  max-width: 450px;
}
.__cover-error-page .title {
  font-size: 1.5rem;
  margin-top: 15px;
  color: #47494e;
  margin-bottom: 8px;
}
.__cover-error-page .description {
  color: #7f828b;
  line-height: 21px;
  margin-bottom: 10px;
}
.__cover-error-page a {
  color: #7f828b !important;
  text-decoration: none;
}
</style>

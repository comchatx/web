/**
 * The words `@comchatx/cx-amazon-ads` 0.1.6 declares of its source in its `comchatx` field, as its package carries them: each field's label, the source's
 * own lines on its Settings and its regions' names. Tests read the page's two levels and the catalogue's reader against them.
 */
export const ADS_SOURCE_WORDS = {
  "help": "https://advertising.amazon.com/API/docs/en-us/guides/account-management/authorization/authorization-grants",
  "name": "amazon-ads",
  "lines": {
    "add": {
      "en": "Add ad accounts",
      "zh": "添加广告账号"
    },
    "none": {
      "en": "Amazon listed no ad account.",
      "zh": "亚马逊没有列出广告账号。"
    },
    "rows": {
      "en": "Ad accounts",
      "zh": "广告账号"
    },
    "silent": {
      "en": "Amazon did not answer for {regions}, so this list may be incomplete.",
      "zh": "亚马逊没有返回{regions}的广告账号，这里可能不全。"
    },
    "connect": {
      "en": "Connect your ad accounts",
      "zh": "连接广告账号"
    },
    "refused": {
      "en": "Amazon no longer accepts this refresh token. Add a new one, then remove this one.",
      "zh": "亚马逊已不接受这个 Refresh token，请添加新的，再移除这一行。"
    },
    "checking": {
      "en": "Checking with Amazon…",
      "zh": "正在向亚马逊确认…"
    },
    "canChange": {
      "en": "Once connected, cx can read and change your ads.",
      "zh": "连接后，cx 可以读取和修改你的广告。"
    },
    "connected": {
      "en": "Ad accounts connected.",
      "zh": "广告账号已连接。"
    },
    "foundNone": {
      "en": "Amazon found no ad account for this token; get a new one with the Amazon account that manages your ads.",
      "zh": "亚马逊没有找到广告账号，请用管理广告的亚马逊账号获取新的 Refresh token。"
    },
    "removedWith": {
      "en": "Its ad accounts {names} are removed with it.",
      "zh": "它的广告账号 {names} 会一并移除。"
    }
  },
  "fields": {
    "client_id": {
      "label": {
        "en": "Client identifier",
        "zh": "Client identifier"
      }
    },
    "client_secret": {
      "label": {
        "en": "Client secret",
        "zh": "Client secret"
      }
    },
    "refresh_token": {
      "label": {
        "en": "Refresh token",
        "zh": "Refresh token"
      }
    }
  },
  "aspects": {},
  "regions": {
    "eu": {
      "en": "Europe",
      "zh": "欧洲"
    },
    "fe": {
      "en": "Far East",
      "zh": "远东"
    },
    "na": {
      "en": "North America",
      "zh": "北美"
    }
  }
} as const;

/**
 * The words `cx-amazon-sp-api` 0.1.13 declares of its source in its `comchatx` field, as its package carries them: each field's label, the source's
 * own lines on its Settings and its regions' names. Four of its lines, `foundNone`, `connected`, `refused` and `none`, are
 * the ones signed on 2026-11-13, which 0.1.12 does not carry. Tests read the page's two levels and the catalogue's reader against them.
 */
export const SP_SOURCE_WORDS = {
  "help": "https://developer-docs.amazon/sp-api/docs/self-authorization",
  "name": "amazon-sp-api",
  "lines": {
    "add": {
      "en": "Add a store",
      "zh": "添加店铺"
    },
    "rows": {
      "en": "Stores",
      "zh": "店铺"
    },
    "sells": {
      "en": "Sells in {places}",
      "zh": "在{places}销售"
    },
    "connect": {
      "en": "Connect your store",
      "zh": "连接店铺"
    },
    "checking": {
      "en": "Checking with Amazon…",
      "zh": "正在向亚马逊确认…"
    },
    "canChange": {
      "en": "Once connected, cx can read and change your store.",
      "zh": "连接后，cx 可以读取和修改你的店铺。"
    },
    "removedWith": {
      "en": "Its stores {names} are removed with it.",
      "zh": "它的店铺 {names} 会一并移除。"
    },
    "foundNone": {
      "en": "Amazon found no store for this token; get a new one with the Amazon account you sell with.",
      "zh": "亚马逊没有找到店铺，请用开店的亚马逊账号获取新的 Refresh token。"
    },
    "connected": {
      "en": "Store connected.",
      "zh": "店铺已连接。"
    },
    "refused": {
      "en": "Amazon no longer accepts this refresh token. Add a new one, then remove this one.",
      "zh": "亚马逊已不接受这个 Refresh token，请添加新的，再移除这一行。"
    },
    "none": {
      "en": "Amazon listed no marketplace for this store.",
      "zh": "亚马逊没有列出这家店铺的站点。"
    }
  },
  "fields": {
    "client_id": {
      "label": {
        "en": "Client identifier",
        "zh": "Client identifier"
      }
    },
    "client_secret": {
      "label": {
        "en": "Client secret",
        "zh": "Client secret"
      }
    },
    "refresh_token": {
      "label": {
        "en": "Refresh token",
        "zh": "Refresh token"
      }
    }
  },
  "aspects": {},
  "regions": {
    "eu": {
      "en": "Europe",
      "zh": "欧洲"
    },
    "fe": {
      "en": "Far East",
      "zh": "远东"
    },
    "na": {
      "en": "North America",
      "zh": "北美"
    }
  }
} as const;

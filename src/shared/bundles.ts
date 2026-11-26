import type { DeclaredMark } from "./drawn-mark.js";
import { DEFAULT_PACKAGES } from "./package-names.js";

/** A bundle's words, one per language. */
export type BundleWords = { readonly en: string; readonly zh: string };

/**
 * An official bundle: its id, which no plugin holds; its name; its mark, drawn as a package's own is; its card's line and
 * its Overview, one markdown text drawn as a package's README is (ruled 2026-11-06), each in both languages; and its members by npm name,
 * in the order a press installs them.
 */
export type OfficialBundle = {
  readonly id: string;
  /** The English name, and the name where a page has no Chinese one. */
  readonly name: string;
  readonly nameZh?: string;
  readonly mark?: DeclaredMark;
  readonly about: BundleWords;
  readonly description: BundleWords;
  readonly members: readonly string[];
};

export const ESSENTIALS_ID = "comchatx-essentials";

/**
 * The official bundles, the one list both halves read: the platform answers `GET /plugins/bundles` with it and checks a press against it,
 * and the page draws it. Each is added here by the office, in a pull request of its own (ruled 2026-11-06). cx Core Bundle comes first:
 * its members are the default packages in their order, the list a new account starts with (`package-names.ts`), so the two cannot differ.
 */
export const OFFICIAL_BUNDLES: readonly OfficialBundle[] = Object.freeze([
  Object.freeze({
    id: ESSENTIALS_ID, name: "cx Core Bundle", nameZh: "cx 基础功能整合包",
    // cx behind an open box, a pack of cx's: signed 2026-11-19.
    mark: Object.freeze<DeclaredMark>({on: "cx", cx: [{x: 12, y: 10.784, size: 25.281}], draw: [{d: "M3.336 15.344L20.664 15.344A0.76 0.76 0 0 1 21.424 16.104L21.424 22.792A0.76 0.76 0 0 1 20.664 23.552L3.336 23.552A0.76 0.76 0 0 1 2.576 22.792L2.576 16.104A0.76 0.76 0 0 1 3.336 15.344ZM2.576 14.614L7.592 14.614L5.616 12.182L0.6 12.182ZM21.424 14.614L16.408 14.614L18.384 12.182L23.4 12.182Z"}]}),
    // Signed 2026-11-10; its names signed 2026-11-17.
    about: Object.freeze({ en: "Searches the web. Reports and your decisions go on a board.", zh: "替你上网查资料，报告和要你决定的事放在对话旁的看板上。" }),
    description: Object.freeze({
      en: "Ask \"What new 20,000 mAh power banks are on Amazon US?\", and cx searches the web and reads the pages before it answers, puts its report on the board beside the chat, and puts what needs your decision in your Inbox.\n\n## Board\n\n- Reports, findings and drafts go on a board beside the chat, in tabs as you need them.\n- What needs you to agree, choose or fill in goes to your Inbox, and you answer it there.\n\n## Conversations\n\n- Each piece of work gets a title in History, and cx reads a quoted message with the ones around it.\n- In a long conversation, the earlier part is summarised so the conversation can go on.\n\n## How cx works\n\n- cx works out what to do and does it with your plugins, and gives a reason and its source when it proposes something.\n\n## Research\n\n- Searches the web and reads web pages and PDFs, with no key to set up.\n\nNew accounts come with these plugins installed. To tell whether a message starts something new, cx-topics asks Jev, paid from your balance.\n\nSome more things you can ask:\n\n- Sum up this article on one page, and put it on the board.\n- Read this PDF and list the points of Amazon's new policy.",
      zh: "问一句“美国站的 20000 毫安充电宝最近有什么新品”，cx 会上网搜索、读完相关网页再回答，整理好的报告放到对话旁的看板上，要你拿主意的事放进收件箱。这段对话也会有个标题，列在「历史」里，方便以后找回。\n\n## 看板\n\n- 报告、发现和草稿放在对话旁的看板上，可以按你的需要分页。\n- 要你同意、选择或填写的事放进收件箱，在那里直接回答。\n\n## 对话\n\n- 每件事都有标题，列在「历史」里；引用旧消息时，cx 会连前后几条一起读。\n- 对话很长时，较早的内容会整理成摘要，对话可以接着进行。\n\n## cx 的工作方式\n\n- cx 自己判断该做什么，用你装的插件完成；提建议时附一句理由和出处。\n\n## 查资料\n\n- 不用另配密钥，就能搜索网页，读取网页和 PDF 的内容。\n\n新账户注册时已预装这些插件。判断每条消息是不是一件新事时，cx-topics 会用 Jev，按用量从余额扣费。\n\n你还可以这样问：\n\n- 把这篇文章的要点整理成一页，放到看板上。\n- 读一下这份 PDF，把亚马逊新政策的要点列出来。",
    }),
    members: DEFAULT_PACKAGES,
  }),
  Object.freeze({
    id: "amazon-seller", name: "Amazon Seller Bundle", nameZh: "亚马逊卖家整合包",
    // Amazon's own smile, white on its orange, as amazon.com's tab draws it: signed 2026-11-19.
    mark: Object.freeze<DeclaredMark>({ground: "#FF6200", draw: [{d: "M-3.627 8.47C-3.771 8.584 -3.801 8.774 -3.718 9.04C-3.642 9.276 -3.463 9.568 -3.182 9.918C-2.05 11.316 -0.701 12.479 0.864 13.406C2.43 14.333 4.105 15.017 5.891 15.457C7.684 15.906 9.515 16.13 11.385 16.13C13.778 16.13 16.058 15.78 18.224 15.081C20.389 14.39 22.198 13.417 23.649 12.163C24.158 11.715 24.413 11.358 24.413 11.092C24.413 10.993 24.371 10.894 24.288 10.796C24.174 10.682 24.037 10.644 23.877 10.682C23.718 10.72 23.493 10.815 23.205 10.967C21.814 11.696 20.12 12.277 18.121 12.71C16.13 13.151 14.052 13.372 11.886 13.372C9.204 13.372 6.613 13.007 4.113 12.277C1.613 11.548 -0.602 10.408 -2.532 8.858C-2.814 8.638 -3.042 8.497 -3.216 8.436C-3.383 8.375 -3.52 8.387 -3.627 8.47ZM21.7 9.041C21.54 9.193 21.498 9.352 21.574 9.52C21.627 9.641 21.73 9.71 21.882 9.725C22.034 9.748 22.251 9.732 22.532 9.679C22.988 9.58 23.463 9.512 23.956 9.474C24.45 9.444 24.88 9.451 25.244 9.497C25.609 9.55 25.837 9.641 25.928 9.77C26.065 9.976 26.016 10.409 25.78 11.07C25.552 11.731 25.241 12.373 24.846 12.996C24.694 13.247 24.602 13.444 24.572 13.589C24.542 13.733 24.58 13.855 24.686 13.954C24.754 14.022 24.83 14.056 24.914 14.056C25.134 14.056 25.453 13.862 25.871 13.475C26.624 12.821 27.152 12.046 27.456 11.15C27.623 10.686 27.726 10.2 27.764 9.691C27.802 9.182 27.744 8.817 27.593 8.596C27.448 8.384 27.129 8.209 26.635 8.072C26.149 7.935 25.659 7.867 25.165 7.867C24.2 7.867 23.284 8.095 22.418 8.551C22.099 8.726 21.859 8.889 21.7 9.041Z", ink: "#FFFFFF"}]}),
    // Signed 2026-11-09, its names 2026-11-17; its members as ruled on 2026-11-06, a needed package before what needs it.
    about: Object.freeze({ en: "Finds why sales fell, then edits your listings and ads.", zh: "找出销量下滑的原因，再替你改 listing、调广告。" }),
    description: Object.freeze({
      en: "Ask why sales fell last week, and cx reads your orders and traffic, ad spend, Buy&nbsp;Box and competitors' prices together, finds the cause, then changes your listings and ads for you.\n\n## Listings\n\n- Reviews a listing step by step from search to purchase, against your store's sales and traffic and Keepa's price and BSR history, and finds why it isn't selling.\n- Rewrites the title, bullet points, description and search terms, with its reasons and the figures behind them.\n- Creates new listings and variations from your product data, in the marketplaces you name.\n- Keeps a record of every change, and tells you once enough time has passed whether it worked.\n- Explains whether your offer holds the Buy&nbsp;Box, why not, and which causes you can fix in your store.\n\n## Ads\n\n- Finds keywords and search terms that spend money without selling, and pauses them or adds them as negative keywords.\n- Finds campaigns that run out of budget, and changes their budgets and bids.\n- Creates campaigns, with the keywords and bids Amazon recommends.\n- Shows each campaign's spend and sales, across Sponsored Products, Sponsored Brands and Sponsored Display.\n\n## Market\n\n- Tracks the price, BSR and Buy&nbsp;Box of your products and your competitors', on 11 Amazon marketplaces.\n- Finds other products on Amazon by search, best-seller list or seller, with their prices, ratings and monthly sales.\n- When a rank falls, finds the day it started and whether the price, a competitor or the stock changed that day.\n\n## Store\n\n- Finds the FBA listings that will run out of stock within two weeks at the last 30 days' rate, with the units available and inbound.\n- Shows each ASIN's traffic, conversion rate and sales.\n- Shows your orders and their total in each marketplace, and which are still pending or were cancelled.\n- Shows the breakdown of each transaction, such as an order payment or a refund, and when deferred transactions are expected to be released.\n\nEach product cx reads from Keepa, and each lookup, is billed to your balance. Reading your store and ads data is free.\n\nSome more things you can ask:\n\n- Ad spend rose last week. Why didn't sales?\n- What are the ten best-selling 20,000 mAh power banks, with their prices and monthly sales?",
      zh: "问一句“上周销量为什么掉了”，cx 会把订单和流量、广告花费、Buy&nbsp;Box 和竞品价格放在一起查，找出原因，再替你改 listing、调广告。\n\n## Listing\n\n- 从搜索到下单逐步检查一条 listing，结合店铺的销量和流量、Keepa 的价格和 BSR 走势，找出卖不动的原因。\n- 改写标题、五点描述、产品描述和后台搜索词，附上理由和依据的数据。\n- 用你的产品资料，在你指定的站点创建新 listing 和变体。\n- 每次修改都留一份记录，观察期结束后判断它是否见效。\n- 分析你的报价有没有拿到 Buy&nbsp;Box、为什么没拿到，以及哪些原因能在店铺里解决。\n\n## 广告\n\n- 找出只花钱不出单的关键词和搜索词，替你暂停，或设为否定关键词。\n- 找出预算不够用的广告活动，替你调整预算和竞价。\n- 创建广告活动，并参考亚马逊推荐的关键词和竞价。\n- 查看每个广告活动的花费和销售额，包括商品推广、品牌推广和展示型推广。\n\n## 市场\n\n- 跟踪你的商品和竞品的价格、BSR 和 Buy&nbsp;Box，覆盖亚马逊 11 个站点。\n- 按搜索词、畅销榜或卖家找出其他商品，对比价格、评分和月销量。\n- 排名下滑时，找出是从哪一天开始的，以及那天价格、竞品或库存有什么变化。\n\n## 店铺\n\n- 按最近 30 天的销量，找出两周内会断货的 FBA 商品，列出可售和在途的数量。\n- 查看每个 ASIN 的流量、转化率和销售额。\n- 按站点查看订单数和金额，以及哪些还在等待处理、哪些已取消。\n- 查看订单付款、退款等每笔交易的金额明细，以及延迟交易预计哪天发放。\n\ncx 每从 Keepa 读取一个商品或做一次查询，都会从你的余额扣费。读取店铺和广告的数据不收费。\n\n你还可以这样问：\n\n- 上周广告花费涨了，销量为什么没涨？\n- 20000 毫安充电宝里卖得最好的十款，价格和月销量各是多少？",
    }),
    members: Object.freeze(["cx-amazon-sp-api", "cx-amazon-seller", "cx-listing-playbook", "cx-keepa", "@comchatx/cx-amazon-ads"]),
  }),
]);

/** The members of an official bundle by npm name; none for an id no official bundle has. */
export const bundleMembers = (id: string, bundles: readonly OfficialBundle[] = OFFICIAL_BUNDLES): readonly string[] | undefined => bundles.find((one) => one.id === id)?.members;

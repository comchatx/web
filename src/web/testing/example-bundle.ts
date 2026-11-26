import type { OfficialBundle } from "../../shared/bundles.js";
import { OFFICIAL_BUNDLES } from "../../shared/bundles.js";
import { catalogueWith, type Catalogue } from "../catalogue.js";
import { MAKERS, OURS, WORDS } from "../canned-catalogue.js";

/**
 * An official bundle beyond the code's, for the tests that play a bundle buying from a source: invented, round 28's Amazon seller with its
 * words, under the id of the code's Amazon Seller, for which it stands in. The preview serves the code's bundles alone. Its list names cx-sources, which Keepa requires, as a bundle's list may name what a member
 * needs.
 */
const SIGNED = OFFICIAL_BUNDLES.find((one) => one.id === "amazon-seller")?.mark;
export const EXAMPLE_SELLER: OfficialBundle = {
  id: "amazon-seller", name: "Amazon seller", ...(SIGNED === undefined ? {} : { mark: SIGNED }),
  about: { en: "Tells cx you sell on Amazon and lets it read products' price and BSR history.", zh: "让 cx 知道你在亚马逊开店，并能查看商品的历史价格和 BSR。" },
  description: { en: "Tells cx you sell on Amazon and lets it read products' price and BSR history.\n\nAn Amazon page shows only today. With this set, cx answers on prices, ranks and competitors against months of history.", zh: "让 cx 知道你在亚马逊开店，并能查看商品的历史价格和 BSR。\n\n亚马逊页面只显示今天的数据。装上它，cx 回答价格、排名和竞品的问题时，会拿几个月的历史来比。" },
  members: ["cx-sources", "cx-keepa", "cx-amazon-seller"],
};

/** The repository's catalogue as the preview draws it, with the example official bundle after the code's, standing in for the code's of its id. */
export const WITH_SELLER: Catalogue = catalogueWith([...OURS, ...MAKERS], [...OFFICIAL_BUNDLES.filter((one) => one.id !== EXAMPLE_SELLER.id), EXAMPLE_SELLER], undefined, WORDS);

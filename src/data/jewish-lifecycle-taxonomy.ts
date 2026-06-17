export interface JewishLifecycleEventType {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  keywords: string[];
}

export const JEWISH_LIFECYCLE_TAXONOMY: JewishLifecycleEventType[] = [
  {
    id: "bris",
    label: "Bris / Brit Milah",
    description: "Circumcision ceremony and seudat mitzvah for a newborn boy.",
    aliases: ["brit milah", "bris milah", "bris", "brit", "milah"],
    keywords: ["sandek", "kvatter", "eliya", "mohel", "baby boy", "chair of elijah", "seudah"]
  },
  {
    id: "baby_naming",
    label: "Baby Naming / Simchat Bat",
    description: "Naming ceremony for a newborn girl or baby naming celebration.",
    aliases: ["baby naming", "simchat bat", "simchas bas", "zeved habat", "kiddush naming"],
    keywords: ["newborn", "name", "daughter", "shul kiddush", "mazel tov baby"]
  },
  {
    id: "pidyon_haben",
    label: "Pidyon Haben",
    description: "Redemption ceremony for a firstborn son.",
    aliases: ["pidyon haben", "pidyon haben", "redemption of firstborn", "firstborn redemption"],
    keywords: ["kohen", "silver coins", "first born", "thirty days", "bechor"]
  },
  {
    id: "upsherin",
    label: "Upsherin / Chalaka",
    description: "First haircut celebration, commonly around age three.",
    aliases: ["upsherin", "upsheren", "chalaka", "halake", "first haircut"],
    keywords: ["haircut", "peyot", "three years old", "aleph bet", "tzitzit", "kippah"]
  },
  {
    id: "bar_mitzvah",
    label: "Bar Mitzvah",
    description: "Coming-of-age celebration for a Jewish boy, usually at age thirteen.",
    aliases: ["bar mitzvah", "barmitzvah", "bar-mitzvah"],
    keywords: ["tefillin", "aliyah", "leining", "haftarah", "parsha", "drasha", "kiddush", "thirteen"]
  },
  {
    id: "bat_mitzvah",
    label: "Bat Mitzvah",
    description: "Coming-of-age celebration for a Jewish girl, usually at age twelve or thirteen.",
    aliases: ["bat mitzvah", "bas mitzvah", "batmitzvah", "bat-mitzvah"],
    keywords: ["drasha", "dvar torah", "mitzvah project", "twelve", "thirteen", "party", "kiddush"]
  },
  {
    id: "vort",
    label: "Vort / Engagement",
    description: "Engagement announcement or celebration before a wedding.",
    aliases: ["vort", "engagement", "lchaim", "l'chaim", "tenaim"],
    keywords: ["ring", "engaged", "mazel tov", "chosson", "kallah", "bride", "groom"]
  },
  {
    id: "wedding",
    label: "Jewish Wedding",
    description: "Chuppah, bedeken, ketubah, dancing, sheva brachot, and wedding meal.",
    aliases: ["wedding", "chasunah", "chassunah", "chuppah", "chupa", "huppah", "marriage"],
    keywords: ["bedeken", "ketubah", "badeken", "yichud", "sheva brachot", "shtick", "mitzvah tantz", "bride", "groom"]
  },
  {
    id: "sheva_brachot",
    label: "Sheva Brachot",
    description: "Post-wedding festive meals during the first week of marriage.",
    aliases: ["sheva brachot", "sheva brochos", "seven blessings"],
    keywords: ["newlyweds", "panim chadashot", "wedding week", "brachot", "meal"]
  },
  {
    id: "pesach",
    label: "Pesach / Passover",
    description: "Passover holiday, seders, matzah, family meals, and outings.",
    aliases: ["pesach", "passover", "seder", "pesah"],
    keywords: ["matzah", "marror", "charoset", "haggadah", "afikomen", "four cups", "yom tov"]
  },
  {
    id: "sukkot",
    label: "Sukkot",
    description: "Sukkah meals, arba minim, chol hamoed trips, and Simchat Torah.",
    aliases: ["sukkot", "succos", "sukkos", "sukkah", "simchat torah", "simchas torah"],
    keywords: ["lulav", "etrog", "hadasim", "aravot", "hoshanot", "sukkah decorations", "hakafot"]
  },
  {
    id: "chanukah",
    label: "Chanukah",
    description: "Menorah lighting, latkes, dreidels, parties, and family gatherings.",
    aliases: ["chanukah", "hanukkah", "hannukah", "chanuka"],
    keywords: ["menorah", "chanukiah", "dreidel", "latkes", "sufganiyot", "gelt", "candles"]
  },
  {
    id: "purim",
    label: "Purim",
    description: "Costumes, Megillah reading, mishloach manot, and Purim seudah.",
    aliases: ["purim", "shushan purim"],
    keywords: ["costume", "megillah", "mishloach manot", "shalach manos", "hamantaschen", "seudah", "gragger"]
  },
  {
    id: "rosh_hashanah",
    label: "Rosh Hashanah",
    description: "Jewish New Year meals, shofar, apples and honey, family gatherings.",
    aliases: ["rosh hashanah", "rosh hashana", "jewish new year"],
    keywords: ["shofar", "apple and honey", "simanim", "round challah", "tashlich"]
  }
];

export function findLifecycleMatches(text: string): JewishLifecycleEventType[] {
  const normalized = text.toLowerCase();
  return JEWISH_LIFECYCLE_TAXONOMY.filter((event) => {
    const terms = [event.label, ...event.aliases, ...event.keywords];
    return terms.some((term) => normalized.includes(term.toLowerCase()));
  });
}

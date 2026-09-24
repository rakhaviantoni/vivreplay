# Card catalog data model

`tcg_sets` owns release metadata. `tcg_card_printings.set_id` is the only release relationship. A printing reads its set name through the foreign key; copied `set_code` and `set_name` are compatibility fields during migration only.

| Data | Canonical table | Reason |
| --- | --- | --- |
| Card code and gameplay identity | `tcg_card_identities` | Stable key for decks, collections, matches, and effects. |
| Cost, power, life, counter, colors, types, attributes, traits | `tcg_card_rules` | Rules are shared by language and reprint. |
| Name, effect text, localized traits | `tcg_card_localizations` | Text varies by language without duplicating rules. |
| Set, language, rarity, variant, printing code, release date | `tcg_card_printings` | Physical card properties vary by release and locale. |
| Remote image URL, provider image ID, rights status | `tcg_card_asset_sources` | Provenance is audit data, not card data. |
| WebP thumb, small, large objects | `tcg_card_assets` | One controlled derivative per printing and size. |
| Inventory, market, sales, listing values | `tcg_price_observations` | Prices are time-series observations. |
| Complete upstream responses | `tcg_source_records` | New or unmodeled fields are never discarded. |

Storage keys use `one-piece/{set}/{language}/{kind}/{printing-code}.webp`. The application looks up an asset record by `printing_id` and `kind`, never lists Storage at request time.

-- Seed allergènes / critères alimentaires (FR/EN + mots-clés JP)
-- Stratégie :
-- - ingredients = mots/expressions à détecter dans une liste d’ingrédients
-- - UPSERT : fusionne a.ingredients + EXCLUDED.ingredients (dédupliqué + trié)
--   => relancer le seed enrichit la base au lieu de ne rien faire.

WITH seed (id, name, name_en, slug, created_at, ingredients, ingredients_en) AS (
  VALUES
    -- Fruits à coque (détaillés par type)
    ('0d550ea2-dd9c-4b58-9ddc-fb18ea8e9a63','Noix','Walnuts','noix','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'noix','noix de Grenoble','cerneaux de noix','huile de noix','noyer','walnut','walnut oil',
        'くるみ','クルミ','胡桃','ウォールナッツ'
      ],
      ARRAY['walnut','walnuts','walnut oil','walnut kernel']),

    ('5ce43ea7-1eb5-4f92-99ea-b04ba804ad91','Amandes','Almonds','amandes','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'amande','amandes','poudre d''amande','lait d''amande','huile d''amande','pâte d''amande',
        'frangipane','massepain','marzipan','orgeat','amaretto',
        'アーモンド','アマンド','アーモンドプードル'
      ],
      ARRAY['almond','almonds','almond flour','almond milk','almond oil','almond paste','frangipane','marzipan','orgeat','amaretto']),

    ('cce44d30-a076-4eeb-97bb-162e9086d8e1','Noisettes','Hazelnuts','noisettes','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'noisette','noisettes','pâte de noisette','huile de noisette','gianduja','praliné','hazelnut',
        'ヘーゼル','ヘーゼルナッツ'
      ],
      ARRAY['hazelnut','hazelnuts','hazelnut paste','hazelnut oil','gianduja','praline']),

    ('461a9b8e-2fab-4de8-8bf8-ee81a4673c1b','Noix de cajou','Cashews','noix-de-cajou','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'noix de cajou','noix d''anacarde','anacarde','cajou','cashew',
        'カシューナッツ','カシュー'
      ],
      ARRAY['cashew','cashews','cashew nut','cashew nuts','anacardium']),

    ('a0212bf4-3898-4e61-986e-09276938c2aa','Pistaches','Pistachios','pistaches','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'pistache','pistaches','pâte de pistache','pistachio','baklava',
        'ピスタチオ','ピスタチオペースト'
      ],
      ARRAY['pistachio','pistachios','pistachio paste','baklava']),

    ('56f06a47-a201-47b1-99ea-ce6c81c23c33','Macadamia','Macadamia nuts','macadamia','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'macadamia','noix de macadamia','huile de macadamia','beurre de macadamia','queensland nut',
        'マカダミア','マカダミアナッツ','マカデミア','クイーンズランドナッツ'
      ],
      ARRAY['macadamia','macadamia nut','macadamia nuts','macadamia oil','macadamia butter','queensland nut']),

    ('63b2d40b-70f1-45c7-bb0a-566ee865d27c','Noix de pécan','Pecans','noix-de-pecan','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'noix de pécan','noix de pecan','pécan','pecan','huile de pécan',
        'ピーカン','ピーカンナッツ','ペカン'
      ],
      ARRAY['pecan','pecans','pecan nut','pecan nuts','pecan oil']),

    ('a6502b91-c64a-4ab9-84a1-807ab17a5213','Noix du Brésil','Brazil nuts','noix-du-bresil','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'noix du brésil','noix du bresil','noix du para','noix de pará','brazil nut',
        'ブラジルナッツ','パラナッツ'
      ],
      ARRAY['brazil nut','brazil nuts','para nut','para nuts']),

    -- Arachides / Cacahuètes (tu as 2 lignes : on garde les 2 mais même mapping)
    ('48970e5b-8ca5-4681-8fac-f565f9644bab','Arachides','Peanuts','arachides','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'arachide','arachides','cacahuète','cacahuètes',
        'beurre d''arachide','beurre de cacahuète','pâte d''arachide','pâte de cacahuète',
        'huile d''arachide','peanut','peanut butter','groundnut','pinda','satay',
        'ピーナッツ','ピーナツ','ピーナッツバター','落花生','南京豆'
      ],
      ARRAY['peanut','peanuts','peanut butter','peanut oil','groundnut','groundnuts','satay']),

    ('5da76fed-dda6-49cf-863a-054cce7ed18a','Cacahuètes','Peanuts','cacahuetes','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'arachide','arachides','cacahuète','cacahuètes',
        'beurre d''arachide','beurre de cacahuète','pâte d''arachide','pâte de cacahuète',
        'huile d''arachide','peanut','peanut butter','groundnut','pinda','satay',
        'ピーナッツ','ピーナツ','ピーナッツバター','落花生','南京豆'
      ],
      ARRAY['peanut','peanuts','peanut butter','peanut oil','groundnut','groundnuts','satay']),

    -- Sésame
    ('3894c558-c53c-447f-90a2-ee09c9249b29','Sésame','Sesame','sesame','2026-02-12 19:32:42.906815+00',
      ARRAY[
        'sésame','graines de sésame','huile de sésame','pâte de sésame','tahin','tahini','halva','gomasio',
        'sesame','sesame oil',
        'ごま','ゴマ','胡麻','芝麻','セサミ','ごま油','ねりごま','練り胡麻','白ごま','黒ごま'
      ],
      ARRAY['sesame','sesame seed','sesame seeds','sesame oil','sesame paste','tahini','halva','gomasio']),

    -- Produits laitiers / lactose (détection “présence de lait”)
    ('27f0045f-4237-406c-bb4d-789c25831cf6','Lactose','Milk','lactose','2026-02-04 21:09:07.53412+00',
      ARRAY[
        'lait','lait en poudre','poudre de lait','lait écrémé','lait entier','lactose','lactosérum','petit-lait',
        'beurre','crème','crème fraîche','fromage','yaourt','kéfir','ghee',
        'caséine','caséinate','whey','lactalbumine','lactoglobuline','produits laitiers',
        'milk','butter','cheese','cream','yogurt','whey',
        '乳','乳成分','牛乳','乳糖','ミルク','バター','チーズ','クリーム','ヨーグルト',
        'カゼイン','ホエイ','脱脂粉乳','練乳'
      ],
      ARRAY['milk','milk powder','skimmed milk powder','whole milk','lactose','whey','butter','cream','cheese','yogurt','kefir','ghee','casein','caseinate','dairy']),

    -- Œufs
    ('7bd5a3b2-bd65-47c9-a091-969376fa6d22','Œufs','Eggs','oeufs','2026-02-04 21:27:41.385183+00',
      ARRAY[
        'oeuf','œuf','oeufs','œufs','blanc d''oeuf','jaune d''oeuf','oeuf en poudre','poudre d''œuf',
        'albumine','ovalbumine','ovomucoïde','lysozyme','mayonnaise','meringue','omelette',
        'egg','egg white','egg yolk','albumen',
        '卵','たまご','玉子','卵白','卵黄','全卵','液卵','エッグ'
      ],
      ARRAY['egg','eggs','egg white','egg whites','egg yolk','egg yolks','egg powder','albumen','albumin','ovalbumin','ovomucoid','lysozyme','mayonnaise','meringue','omelette']),

    -- Soja
    ('e61b77db-ea31-428a-be4b-b25b4517abde','Soja','Soy','soja','2026-02-04 21:27:41.385183+00',
      ARRAY[
        'soja','fève de soja','protéine de soja','lécithine de soja','isoflavones',
        'tofu','tempeh','miso','shoyu','tamari','sauce soja','edamame','tonyu','okara','yuba','natto',
        'soy','soya','soy sauce',
        '大豆','豆乳','豆腐','味噌','醤油','枝豆','納豆','おから','湯葉','ソイ'
      ],
      ARRAY['soy','soya','soybean','soybeans','soy protein','soy lecithin','tofu','tempeh','miso','shoyu','tamari','soy sauce','edamame','soy milk','okara','yuba','natto']),

    -- Gluten / Sans gluten (mots “sources de gluten”)
    ('de24e256-7bc8-4d32-846c-e5aae9c0d3f7','Sans gluten','Gluten free','sans-gluten','2026-02-04 16:56:02.164346+00',
      ARRAY[
        'gluten','blé','froment','épeautre','seigle','orge','avoine','kamut','triticale',
        'farine','farine de blé','semoule','boulgour','couscous','malt','chapelure','panure','seitan','pâtes',
        'wheat','barley','rye','spelt','malt',
        '小麦','小麦粉','大麦','ライ麦','オート麦','麦芽','グルテン','パン粉','セイタン'
      ],
      ARRAY['gluten','wheat','wheat flour','barley','rye','spelt','oat','oats','kamut','triticale','semolina','bulgur','couscous','malt','breadcrumbs','breading','seitan','pasta']),

    -- Crustacés / Sans crustacés
    ('62f38e63-a12f-45ff-9377-39bec7b27a94','Sans crustacés','Crustacean free','sans-crustaces','2026-02-04 16:56:02.164346+00',
      ARRAY[
        'crustacé','crustacés','crevette','gambas','scampi','langoustine','langouste','homard','krill',
        'crabe','écrevisse','tourteau','araignée de mer',
        'shrimp','prawn','lobster','crab','crayfish','krill',
        'えび','エビ','海老','甘エビ','かに','カニ','蟹','シャコ','オキアミ'
      ],
      ARRAY['crustacean','crustaceans','shrimp','prawn','prawns','scampi','langoustine','langoustines','lobster','crab','crayfish','krill']),

    -- Vegan : mots “non vegan” (présence d’origine animale)
    ('a31ba49a-8aef-4d46-a0f0-ed7bf5bdb3fc','Vegan','Vegan','vegan','2026-02-04 16:56:02.164346+00',
      ARRAY[
        'viande','boeuf','bœuf','veau','porc','agneau','mouton','canard','dinde','poulet','volaille',
        'poisson','crustacé','fruits de mer',
        'lait','beurre','crème','fromage','yaourt','lactose','caséine','petit-lait','lactosérum',
        'oeuf','œuf','miel','cire d''abeille',
        'gélatine','gelatine','présure','graisse animale','saindoux','lard',
        'carmine','cochenille','lanoline','shellac',
        'meat','beef','pork','lamb','chicken','fish','honey','gelatin','whey','casein',
        '肉','牛肉','豚肉','鶏肉','魚','海老','蟹',
        '乳','卵','蜂蜜','ゼラチン','ホエイ','カゼイン','ラード','動物性'
      ],
      ARRAY['meat','beef','veal','pork','lamb','mutton','duck','turkey','chicken','poultry','fish','seafood','milk','butter','cream','cheese','yogurt','lactose','casein','whey','egg','eggs','honey','beeswax','gelatin','rennet','animal fat','lard','carmine','cochineal','lanolin','shellac']),

    -- Halal : mots “à risque / non halal” (selon ton approche : porc + alcool + viandes/gelatines)
    ('f1a00000-0000-0000-0000-000000000001','Halal','Halal','halal','2026-02-04 16:56:02.164346+00',
      ARRAY[
        -- porc / charcuterie / graisses
        'porc','cochon','sanglier','lard','saindoux','graisse de porc','gélatine de porc','gelatine de porc',
        'jambon','bacon','saucisson','charcuterie','rillettes','pâté','andouille','chorizo',
        -- viandes (approche “safe”)
        'viande','boeuf','bœuf','veau','agneau','mouton','poulet','volaille','canard','dinde',
        'graisse animale','gélatine animale','gelatine animale','présure',
        -- alcool (boissons + ingrédients cuisine)
        'alcool','alcool de riz','éthanol','spiritueux','bière','vin','cidre','liqueur','whisky','rhum','vodka','gin','brandy',
        'sake','saké','mirin','shochu','shōchū','cooking wine',
        -- JP
        '豚','豚肉','豚脂','ラード','ベーコン','ハム','ソーセージ','チャーシュー',
        '肉','牛肉','鶏肉',
        'ゼラチン','動物性ゼラチン',
        'アルコール','酒','酒精','アルコール飲料','ビール','ワイン','ウイスキー','焼酎','清酒','日本酒','みりん'
      ],
      ARRAY['pork','pig','boar','lard','pork fat','pork gelatin','ham','bacon','sausage','charcuterie','meat','beef','veal','lamb','mutton','chicken','poultry','duck','turkey','animal gelatin','rennet','alcohol','rice alcohol','ethanol','spirits','beer','wine','cider','liqueur','whisky','rum','vodka','gin','brandy','sake','mirin','shochu','cooking wine'])
)

INSERT INTO public.allergens AS a (id, name, name_en, slug, created_at, ingredients, ingredients_en)
SELECT id::uuid, name, name_en, slug, created_at::timestamptz, ingredients, ingredients_en
FROM seed
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  ingredients = (
    SELECT ARRAY(
      SELECT DISTINCT w
      FROM unnest(
        COALESCE(a.ingredients, ARRAY[]::text[])
        || COALESCE(EXCLUDED.ingredients, ARRAY[]::text[])
      ) AS w
      WHERE w IS NOT NULL AND btrim(w) <> ''
      ORDER BY 1
    )
  ),
  ingredients_en = (
    SELECT ARRAY(
      SELECT DISTINCT w
      FROM unnest(
        COALESCE(a.ingredients_en, ARRAY[]::text[])
        || COALESCE(EXCLUDED.ingredients_en, ARRAY[]::text[])
      ) AS w
      WHERE w IS NOT NULL AND btrim(w) <> ''
      ORDER BY 1
    )
  );

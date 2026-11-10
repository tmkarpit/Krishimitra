-- KrishiMitra reference data.
-- Crop ranges are agronomic guide values (ICAR / state agri-university packages of practice);
-- prices are MSP 2025-26 where one exists, otherwise an indicative mandi average (₹/quintal).

insert into public.languages (code, bcp47, name_english, name_native, sort_order) values
  ('en', 'en-IN', 'English',   'English',   0),
  ('hi', 'hi-IN', 'Hindi',     'हिन्दी',     1),
  ('mr', 'mr-IN', 'Marathi',   'मराठी',     2),
  ('pa', 'pa-IN', 'Punjabi',   'ਪੰਜਾਬੀ',     3),
  ('gu', 'gu-IN', 'Gujarati',  'ગુજરાતી',    4),
  ('bn', 'bn-IN', 'Bengali',   'বাংলা',      5),
  ('ta', 'ta-IN', 'Tamil',     'தமிழ்',      6),
  ('te', 'te-IN', 'Telugu',    'తెలుగు',     7),
  ('kn', 'kn-IN', 'Kannada',   'ಕನ್ನಡ',      8),
  ('ml', 'ml-IN', 'Malayalam', 'മലയാളം',    9),
  ('or', 'or-IN', 'Odia',      'ଓଡ଼ିଆ',      10)
on conflict (code) do nothing;

-- Dominant soil per state (broad NBSS&LUP groups) — a fallback, not a substitute for a soil test.
insert into public.states (code, name, soil_texture, soil_ph, soil_group) values
  ('AP','Andhra Pradesh','clay_loam',7.2,'red and black'),
  ('AR','Arunachal Pradesh','loamy',5.2,'hill forest (acidic)'),
  ('AS','Assam','loamy',5.5,'alluvial (acidic)'),
  ('BR','Bihar','loamy',7.5,'alluvial'),
  ('CT','Chhattisgarh','sandy_loam',6.3,'red and yellow'),
  ('GA','Goa','sandy_loam',5.5,'laterite'),
  ('GJ','Gujarat','clay_loam',7.8,'black and alluvial'),
  ('HR','Haryana','sandy_loam',8.0,'alluvial'),
  ('HP','Himachal Pradesh','loamy',6.0,'mountain'),
  ('JH','Jharkhand','sandy_loam',5.8,'red'),
  ('KA','Karnataka','clay_loam',6.8,'red and black'),
  ('KL','Kerala','sandy_loam',5.2,'laterite'),
  ('MP','Madhya Pradesh','clayey',7.6,'black (regur)'),
  ('MH','Maharashtra','clayey',7.8,'black (regur)'),
  ('MN','Manipur','loamy',5.2,'hill forest (acidic)'),
  ('ML','Meghalaya','loamy',5.0,'hill forest (acidic)'),
  ('MZ','Mizoram','loamy',5.0,'hill forest (acidic)'),
  ('NL','Nagaland','loamy',5.0,'hill forest (acidic)'),
  ('OR','Odisha','sandy_loam',6.0,'red and laterite'),
  ('PB','Punjab','loamy',8.0,'alluvial'),
  ('RJ','Rajasthan','sandy',8.2,'desert'),
  ('SK','Sikkim','loamy',5.5,'mountain'),
  ('TN','Tamil Nadu','sandy_loam',7.0,'red loam'),
  ('TG','Telangana','sandy_loam',7.2,'red and black'),
  ('TR','Tripura','loamy',5.3,'hill forest (acidic)'),
  ('UP','Uttar Pradesh','loamy',7.8,'alluvial'),
  ('UT','Uttarakhand','loamy',6.2,'mountain'),
  ('WB','West Bengal','clay_loam',6.2,'alluvial (delta)'),
  ('AN','Andaman and Nicobar Islands','loamy',5.8,'forest'),
  ('CH','Chandigarh','loamy',7.8,'alluvial'),
  ('DH','Dadra and Nagar Haveli and Daman and Diu','sandy_loam',6.0,'laterite'),
  ('DL','Delhi','sandy_loam',7.8,'alluvial'),
  ('JK','Jammu and Kashmir','loamy',7.0,'mountain'),
  ('LA','Ladakh','sandy',8.0,'cold desert'),
  ('LD','Lakshadweep','sandy',8.0,'coral sand'),
  ('PY','Puducherry','sandy_loam',7.2,'coastal alluvial')
on conflict (code) do nothing;

insert into public.fertilizers (slug, name, n_pct, p_pct, k_pct, price_per_kg_inr) values
  ('urea', 'Urea',                           46, 0,  0,  5.36),
  ('dap',  'DAP (Di-ammonium phosphate)',    18, 46, 0,  27.0),
  ('mop',  'MOP (Muriate of potash)',        0,  0,  60, 34.0),
  ('ssp',  'SSP (Single super phosphate)',   0,  16, 0,  10.0),
  ('npk_10_26_26', 'NPK 10:26:26',           10, 26, 26, 29.5)
on conflict (slug) do nothing;

insert into public.crops (slug, scientific_name, family, category, seasons, duration_days_min, duration_days_max,
  temp_min, temp_max, rainfall_min_mm, rainfall_max_mm, humidity_min, humidity_max, ph_min, ph_max,
  water_requirement, soil_textures, n_req_kg_ha, p_req_kg_ha, k_req_kg_ha, avg_yield_q_ha, cost_per_ha_inr,
  default_price_inr_q, msp_inr_q, agmarknet_commodity, emoji) values
  ('rice','Oryza sativa','poaceae','cereal','{kharif}',110,150,20,35,1000,2500,60,95,5.0,8.0,'high','{clayey,clay_loam,silty,loamy}',120,60,40,45,60000,2369,2369,'Paddy(Dhan)(Common)','🌾'),
  ('wheat','Triticum aestivum','poaceae','cereal','{rabi}',110,140,10,25,300,600,40,75,6.0,8.5,'medium','{loamy,clay_loam,sandy_loam}',120,60,40,40,50000,2585,2585,'Wheat','🌾'),
  ('maize','Zea mays','poaceae','cereal','{kharif,rabi,zaid}',90,120,18,32,500,900,50,85,5.5,8.0,'medium','{loamy,sandy_loam,clay_loam}',150,60,40,35,45000,2400,2400,'Maize','🌽'),
  ('bajra','Pennisetum glaucum','poaceae','millet','{kharif,zaid}',70,90,25,35,250,600,30,75,6.5,8.5,'low','{sandy,sandy_loam,loamy}',60,30,20,18,22000,2775,2775,'Bajra(Pearl Millet/Cumbu)','🌾'),
  ('jowar','Sorghum bicolor','poaceae','millet','{kharif,rabi}',100,120,25,32,400,700,40,75,6.0,8.5,'low','{clayey,clay_loam,loamy}',80,40,40,20,25000,3699,3699,'Jowar(Sorghum)','🌾'),
  ('ragi','Eleusine coracana','poaceae','millet','{kharif}',100,120,20,30,500,900,50,85,5.0,7.5,'low','{sandy_loam,loamy,clay_loam}',50,40,25,20,25000,4886,4886,'Ragi (Finger Millet)','🌾'),
  ('chickpea','Cicer arietinum','fabaceae','pulse','{rabi}',95,120,15,28,250,450,15,60,6.0,8.5,'low','{loamy,sandy_loam,clay_loam}',20,50,20,15,30000,5875,5875,'Bengal Gram(Gram)(Whole)','🫘'),
  ('pigeonpeas','Cajanus cajan','fabaceae','pulse','{kharif}',150,200,20,35,600,1000,45,75,6.0,8.0,'low','{loamy,sandy_loam,clay_loam}',25,50,20,12,30000,8000,8000,'Arhar (Tur/Red Gram)(Whole)','🫘'),
  ('mungbean','Vigna radiata','fabaceae','pulse','{kharif,zaid}',60,75,25,35,350,650,50,90,6.2,8.0,'low','{loamy,sandy_loam}',20,40,20,8,22000,8768,8768,'Green Gram (Moong)(Whole)','🫘'),
  ('blackgram','Vigna mungo','fabaceae','pulse','{kharif,zaid}',70,90,25,35,400,700,60,85,6.0,8.0,'low','{clay_loam,loamy}',20,40,20,8,22000,7800,7800,'Black Gram (Urd Beans)(Whole)','🫘'),
  ('lentil','Lens culinaris','fabaceae','pulse','{rabi}',100,130,15,25,250,400,40,75,6.0,8.0,'low','{loamy,clay_loam,sandy_loam}',20,40,20,12,25000,7000,7000,'Lentil (Masur)(Whole)','🫘'),
  ('kidneybeans','Phaseolus vulgaris','fabaceae','pulse','{rabi,kharif}',90,120,15,25,300,500,20,65,5.5,7.0,'medium','{loamy,sandy_loam}',90,60,40,15,40000,9000,null,null,'🫘'),
  ('mothbeans','Vigna aconitifolia','fabaceae','pulse','{kharif}',75,90,25,38,250,500,40,70,6.5,8.5,'low','{sandy,sandy_loam}',15,30,10,6,15000,6500,null,'Moath Dal','🫘'),
  ('soybean','Glycine max','fabaceae','oilseed','{kharif}',90,110,20,32,600,1000,60,85,6.0,8.0,'medium','{loamy,clay_loam,clayey}',30,60,40,20,35000,5328,5328,'Soyabean','🫘'),
  ('groundnut','Arachis hypogaea','fabaceae','oilseed','{kharif,zaid}',100,130,22,32,500,1000,50,80,6.0,8.0,'medium','{sandy,sandy_loam,loamy}',20,40,40,18,45000,7263,7263,'Groundnut','🥜'),
  ('mustard','Brassica juncea','brassicaceae','oilseed','{rabi}',110,140,10,25,250,400,30,70,6.0,8.5,'low','{loamy,sandy_loam}',80,40,40,15,30000,6200,6200,'Mustard','🌼'),
  ('cotton','Gossypium hirsutum','malvaceae','fibre','{kharif}',150,180,21,35,500,1000,50,80,5.8,8.5,'medium','{clayey,clay_loam,loamy}',120,60,60,20,65000,7710,7710,'Cotton','☁️'),
  ('jute','Corchorus olitorius','malvaceae','fibre','{kharif}',120,150,24,37,1200,2000,70,95,6.0,7.5,'high','{loamy,clay_loam,silty}',60,30,30,25,40000,5650,5650,'Jute','🧵'),
  ('sugarcane','Saccharum officinarum','poaceae','cash','{rabi,zaid}',300,365,20,35,1500,2500,60,85,6.0,8.5,'high','{loamy,clay_loam}',250,100,120,800,150000,355,355,'Sugarcane','🎋'),
  ('potato','Solanum tuberosum','solanaceae','vegetable','{rabi}',90,120,15,25,400,600,60,85,5.0,6.5,'medium','{sandy_loam,loamy}',180,80,100,250,120000,1200,null,'Potato','🥔'),
  ('onion','Allium cepa','amaryllidaceae','vegetable','{rabi,kharif}',100,140,13,30,350,550,50,75,6.0,8.0,'medium','{loamy,sandy_loam,clay_loam}',100,50,80,250,110000,1800,null,'Onion','🧅'),
  ('tomato','Solanum lycopersicum','solanaceae','vegetable','{kharif,rabi,zaid}',90,120,18,30,400,600,50,80,6.0,7.0,'medium','{loamy,sandy_loam}',120,60,60,300,150000,1500,null,'Tomato','🍅'),
  ('chilli','Capsicum annuum','solanaceae','spice','{kharif,rabi}',150,180,20,30,600,1250,50,80,6.0,7.5,'medium','{loamy,sandy_loam,clay_loam}',120,60,60,25,120000,12000,null,'Dry Chillies','🌶️'),
  ('turmeric','Curcuma longa','zingiberaceae','spice','{kharif}',240,270,20,35,1500,2250,70,90,5.0,7.5,'high','{loamy,clay_loam,sandy_loam}',60,50,120,60,150000,12000,null,'Turmeric','🟡'),
  ('banana','Musa acuminata','musaceae','fruit','{perennial,kharif}',300,365,20,35,1500,2500,70,95,6.0,7.5,'high','{loamy,clay_loam}',200,60,300,500,250000,1200,null,'Banana','🍌'),
  ('mango','Mangifera indica','anacardiaceae','fruit','{perennial,kharif}',365,365,24,35,750,2500,45,80,5.5,7.5,'medium','{loamy,sandy_loam,clay_loam}',100,50,100,100,100000,4000,null,'Mango','🥭'),
  ('papaya','Carica papaya','caricaceae','fruit','{perennial,kharif,zaid}',270,330,22,35,1000,2000,60,95,6.0,7.0,'medium','{loamy,sandy_loam}',200,200,250,500,200000,1500,null,'Papaya','🍈'),
  ('pomegranate','Punica granatum','lythraceae','fruit','{perennial}',365,365,25,38,500,800,30,65,6.5,8.0,'low','{sandy_loam,loamy}',150,70,150,120,200000,6000,null,'Pomegranate','🔴'),
  ('grapes','Vitis vinifera','vitaceae','fruit','{perennial}',365,365,15,35,500,900,40,85,6.5,8.0,'medium','{sandy_loam,loamy}',200,100,200,200,400000,5000,null,'Grapes','🍇'),
  ('watermelon','Citrullus lanatus','cucurbitaceae','fruit','{zaid}',80,100,24,35,400,600,50,90,6.0,7.0,'medium','{sandy,sandy_loam}',100,60,60,300,80000,1000,null,'Water Melon','🍉'),
  ('muskmelon','Cucumis melo','cucurbitaceae','fruit','{zaid}',80,100,24,35,400,600,50,95,6.0,7.5,'medium','{sandy,sandy_loam}',100,50,50,150,80000,1500,null,'Karbuja(Musk Melon)','🍈'),
  ('coconut','Cocos nucifera','arecaceae','plantation','{perennial}',365,365,20,32,1500,2500,70,95,5.0,8.0,'high','{sandy,sandy_loam,loamy}',100,40,150,100,100000,2500,null,'Coconut','🥥'),
  ('coffee','Coffea arabica','rubiaceae','plantation','{perennial}',365,365,15,28,1500,2500,60,90,5.0,6.5,'medium','{loamy,clay_loam}',120,90,120,10,150000,30000,null,'Coffee','☕'),
  ('orange','Citrus reticulata','rutaceae','fruit','{perennial}',365,365,10,35,750,1200,50,90,5.5,7.5,'medium','{loamy,sandy_loam}',150,75,150,120,150000,4000,null,'Orange','🍊'),
  ('apple','Malus domestica','rosaceae','fruit','{perennial}',365,365,5,24,1000,1250,50,95,5.5,6.5,'medium','{loamy}',120,60,120,100,300000,8000,null,'Apple','🍎')
on conflict (slug) do nothing;

-- Crop names (en, hi, mr). Other languages fall back to English in the app;
-- AI-generated screens return names in the farmer's language directly.
insert into public.crop_translations (crop_id, language_code, name)
select c.id, t.lang, t.name
from (values
  ('rice','en','Rice (Paddy)'),('rice','hi','धान (चावल)'),('rice','mr','भात'),
  ('wheat','en','Wheat'),('wheat','hi','गेहूँ'),('wheat','mr','गहू'),
  ('maize','en','Maize'),('maize','hi','मक्का'),('maize','mr','मका'),
  ('bajra','en','Pearl Millet (Bajra)'),('bajra','hi','बाजरा'),('bajra','mr','बाजरी'),
  ('jowar','en','Sorghum (Jowar)'),('jowar','hi','ज्वार'),('jowar','mr','ज्वारी'),
  ('ragi','en','Finger Millet (Ragi)'),('ragi','hi','रागी (मंडुआ)'),('ragi','mr','नाचणी'),
  ('chickpea','en','Chickpea (Gram)'),('chickpea','hi','चना'),('chickpea','mr','हरभरा'),
  ('pigeonpeas','en','Pigeon Pea (Tur/Arhar)'),('pigeonpeas','hi','अरहर (तूर)'),('pigeonpeas','mr','तूर'),
  ('mungbean','en','Green Gram (Moong)'),('mungbean','hi','मूंग'),('mungbean','mr','मूग'),
  ('blackgram','en','Black Gram (Urad)'),('blackgram','hi','उड़द'),('blackgram','mr','उडीद'),
  ('lentil','en','Lentil (Masoor)'),('lentil','hi','मसूर'),('lentil','mr','मसूर'),
  ('kidneybeans','en','Kidney Beans (Rajma)'),('kidneybeans','hi','राजमा'),('kidneybeans','mr','राजमा'),
  ('mothbeans','en','Moth Bean'),('mothbeans','hi','मोठ'),('mothbeans','mr','मटकी'),
  ('soybean','en','Soybean'),('soybean','hi','सोयाबीन'),('soybean','mr','सोयाबीन'),
  ('groundnut','en','Groundnut'),('groundnut','hi','मूंगफली'),('groundnut','mr','भुईमूग'),
  ('mustard','en','Mustard'),('mustard','hi','सरसों'),('mustard','mr','मोहरी'),
  ('cotton','en','Cotton'),('cotton','hi','कपास'),('cotton','mr','कापूस'),
  ('jute','en','Jute'),('jute','hi','जूट (पटसन)'),('jute','mr','ताग'),
  ('sugarcane','en','Sugarcane'),('sugarcane','hi','गन्ना'),('sugarcane','mr','ऊस'),
  ('potato','en','Potato'),('potato','hi','आलू'),('potato','mr','बटाटा'),
  ('onion','en','Onion'),('onion','hi','प्याज'),('onion','mr','कांदा'),
  ('tomato','en','Tomato'),('tomato','hi','टमाटर'),('tomato','mr','टोमॅटो'),
  ('chilli','en','Chilli'),('chilli','hi','मिर्च'),('chilli','mr','मिरची'),
  ('turmeric','en','Turmeric'),('turmeric','hi','हल्दी'),('turmeric','mr','हळद'),
  ('banana','en','Banana'),('banana','hi','केला'),('banana','mr','केळी'),
  ('mango','en','Mango'),('mango','hi','आम'),('mango','mr','आंबा'),
  ('papaya','en','Papaya'),('papaya','hi','पपीता'),('papaya','mr','पपई'),
  ('pomegranate','en','Pomegranate'),('pomegranate','hi','अनार'),('pomegranate','mr','डाळिंब'),
  ('grapes','en','Grapes'),('grapes','hi','अंगूर'),('grapes','mr','द्राक्षे'),
  ('watermelon','en','Watermelon'),('watermelon','hi','तरबूज'),('watermelon','mr','कलिंगड'),
  ('muskmelon','en','Muskmelon'),('muskmelon','hi','खरबूजा'),('muskmelon','mr','खरबूज'),
  ('coconut','en','Coconut'),('coconut','hi','नारियल'),('coconut','mr','नारळ'),
  ('coffee','en','Coffee'),('coffee','hi','कॉफ़ी'),('coffee','mr','कॉफी'),
  ('orange','en','Orange'),('orange','hi','संतरा'),('orange','mr','संत्री'),
  ('apple','en','Apple'),('apple','hi','सेब'),('apple','mr','सफरचंद')
) as t(slug, lang, name)
join public.crops c on c.slug = t.slug
on conflict do nothing;

insert into public.schemes (slug, level, official_url, eligible_farmer_types, sort_order) values
  ('pm-kisan',  'central', 'https://pmkisan.gov.in',                       '{marginal,small,semi_medium,medium,large}', 1),
  ('pmfby',     'central', 'https://pmfby.gov.in',                         null, 2),
  ('soil-health-card', 'central', 'https://soilhealth.dac.gov.in',         null, 3),
  ('kcc',       'central', 'https://www.myscheme.gov.in/schemes/kcc',      null, 4),
  ('pm-kusum',  'central', 'https://pmkusum.mnre.gov.in',                  null, 5),
  ('e-nam',     'central', 'https://enam.gov.in',                          null, 6),
  ('pmksy',     'central', 'https://pmksy.gov.in',                         null, 7),
  ('pkvy',      'central', 'https://www.myscheme.gov.in/schemes/pkvy',     null, 8)
on conflict (slug) do nothing;

insert into public.scheme_translations (scheme_id, language_code, title, summary, benefits, eligibility, how_to_apply)
select s.id, t.lang, t.title, t.summary, t.benefits, t.eligibility, t.how_to_apply
from (values
  ('pm-kisan','en','PM-KISAN','Direct income support for farmer families.','₹6,000 per year in three instalments of ₹2,000, paid directly to your bank account.','All landholding farmer families. Income-tax payers and institutional landholders are excluded.','Register at pmkisan.gov.in, through your nearest CSC centre, or with the village patwari. Keep Aadhaar, bank passbook and land records ready. Complete e-KYC.'),
  ('pm-kisan','hi','पीएम-किसान','किसान परिवारों को सीधी आय सहायता।','हर साल ₹6,000, ₹2,000 की तीन किस्तों में सीधे बैंक खाते में।','सभी भूमिधारक किसान परिवार। आयकर दाता और संस्थागत भूमिधारक पात्र नहीं।','pmkisan.gov.in पर, नज़दीकी CSC केंद्र पर या पटवारी के पास पंजीकरण करें। आधार, बैंक पासबुक और भूमि रिकॉर्ड साथ रखें। e-KYC पूरा करें।'),
  ('pmfby','en','PM Fasal Bima Yojana','Low-premium crop insurance against natural calamities, pests and diseases.','Farmer premium only 2% (kharif), 1.5% (rabi) and 5% (commercial/horticulture crops) of sum insured.','All farmers, including tenants and sharecroppers, growing notified crops in notified areas.','Apply through your bank, CSC centre, insurance company or pmfby.gov.in before the season cut-off date.'),
  ('pmfby','hi','प्रधानमंत्री फसल बीमा योजना','प्राकृतिक आपदा, कीट और रोग से फसल नुकसान पर कम प्रीमियम वाला बीमा।','किसान का प्रीमियम केवल 2% (खरीफ), 1.5% (रबी) और 5% (व्यावसायिक/बागवानी फसलें)।','अधिसूचित क्षेत्रों में अधिसूचित फसल उगाने वाले सभी किसान, बटाईदार सहित।','अंतिम तिथि से पहले बैंक, CSC केंद्र, बीमा कंपनी या pmfby.gov.in पर आवेदन करें।'),
  ('soil-health-card','en','Soil Health Card','Free soil testing with crop-wise nutrient recommendations.','Free card showing N, P, K, pH and micronutrients of your soil, with fertilizer advice for your crops.','All farmers.','Contact your agriculture department office or Krishi Vigyan Kendra, or visit soilhealth.dac.gov.in. You can scan your card in KrishiMitra.'),
  ('soil-health-card','hi','मृदा स्वास्थ्य कार्ड','मुफ्त मिट्टी जांच और फसल अनुसार पोषक तत्व सलाह।','मिट्टी के N, P, K, pH और सूक्ष्म पोषक तत्वों की जानकारी वाला मुफ्त कार्ड, खाद की सलाह के साथ।','सभी किसान।','कृषि विभाग कार्यालय या कृषि विज्ञान केंद्र से संपर्क करें, या soilhealth.dac.gov.in देखें। आप KrishiMitra में अपना कार्ड स्कैन कर सकते हैं।'),
  ('kcc','en','Kisan Credit Card','Short-term crop loans at low interest.','Loans up to ₹3 lakh at 7% interest; effectively 4% with prompt repayment.','Farmers, tenant farmers, sharecroppers, SHGs, and fishery/animal-husbandry farmers.','Apply at any bank branch with Aadhaar, land records and a passport photo.'),
  ('kcc','hi','किसान क्रेडिट कार्ड','कम ब्याज पर अल्पकालिक फसल ऋण।','₹3 लाख तक का ऋण 7% ब्याज पर; समय पर चुकाने पर प्रभावी दर 4%।','किसान, बटाईदार, स्वयं सहायता समूह, मछली/पशुपालक किसान।','आधार, भूमि रिकॉर्ड और फोटो के साथ किसी भी बैंक शाखा में आवेदन करें।'),
  ('pm-kusum','en','PM-KUSUM','Subsidy for solar irrigation pumps.','Up to 60% subsidy on standalone solar pumps; sell surplus power to the grid.','Individual farmers, groups, cooperatives and FPOs.','Apply on your state renewable-energy agency portal or pmkusum.mnre.gov.in.'),
  ('pm-kusum','hi','पीएम-कुसुम','सोलर सिंचाई पंप पर सब्सिडी।','सोलर पंप पर 60% तक सब्सिडी; अतिरिक्त बिजली ग्रिड को बेचें।','व्यक्तिगत किसान, समूह, सहकारी समितियां और FPO।','राज्य अक्षय ऊर्जा एजेंसी पोर्टल या pmkusum.mnre.gov.in पर आवेदन करें।'),
  ('e-nam','en','e-NAM','Online national market to sell your produce.','Sell to buyers across India with transparent bidding and online payment.','All farmers registered with an e-NAM mandi.','Register at enam.gov.in or at your nearest e-NAM mandi with bank and ID details.'),
  ('e-nam','hi','ई-नाम','उपज बेचने के लिए ऑनलाइन राष्ट्रीय मंडी।','पारदर्शी बोली और ऑनलाइन भुगतान के साथ पूरे भारत के खरीदारों को बेचें।','e-NAM मंडी में पंजीकृत सभी किसान।','enam.gov.in या नज़दीकी e-NAM मंडी में बैंक और पहचान विवरण के साथ पंजीकरण करें।'),
  ('pmksy','en','PM Krishi Sinchayee Yojana','Subsidy for drip and sprinkler irrigation ("More crop per drop").','55% subsidy for small/marginal farmers and 45% for others on micro-irrigation systems.','All farmers with land and a water source.','Apply through the district agriculture/horticulture office or state micro-irrigation portal.'),
  ('pmksy','hi','प्रधानमंत्री कृषि सिंचाई योजना','ड्रिप और स्प्रिंकलर सिंचाई पर सब्सिडी ("प्रति बूंद अधिक फसल")।','लघु/सीमांत किसानों को 55% और अन्य को 45% सब्सिडी।','ज़मीन और पानी के स्रोत वाले सभी किसान।','ज़िला कृषि/उद्यान कार्यालय या राज्य सूक्ष्म सिंचाई पोर्टल से आवेदन करें।'),
  ('pkvy','en','Paramparagat Krishi Vikas Yojana','Support for organic farming in clusters.','₹31,500 per hectare over 3 years for organic inputs, certification and marketing.','Farmer groups/clusters adopting organic farming.','Contact your district agriculture office to join an organic cluster.'),
  ('pkvy','hi','परंपरागत कृषि विकास योजना','क्लस्टर में जैविक खेती के लिए सहायता।','3 साल में ₹31,500 प्रति हेक्टेयर जैविक इनपुट, प्रमाणन और विपणन के लिए।','जैविक खेती अपनाने वाले किसान समूह/क्लस्टर।','जैविक क्लस्टर से जुड़ने के लिए ज़िला कृषि कार्यालय से संपर्क करें।')
) as t(slug, lang, title, summary, benefits, eligibility, how_to_apply)
join public.schemes s on s.slug = t.slug
on conflict do nothing;

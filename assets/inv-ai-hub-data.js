/* ============================================================
   AI Hub — Inventory KPI root-cause drilldown data.
   Same schema as Schedule Insight's ai-hub-data.js (AHUB_KPI_DATA /
   AHUB_IMPACT_DATA), rendered by ai-hub-render.js.

   7 food / inventory KPIs from HubWorks Zip Inventory (HW Release):
     Act. Food Cost %   actual usage $ ÷ sales           EOInvMain.actualUsagePer
     Variance %         (actual − ideal) ÷ sales          EOInvMain.variancePer
     Waste %            waste $ ÷ sales                   EOWstMain / EOInvFinDetail
     Price Change Impact  (new − old unit cost) × received qty   EOSiteVit price alert
     Days on Hand       inventory $ ÷ avg daily actual $  EOInvMain
     Below PAR Items    closing qty < min PAR (+ short-shipped lines)
     Count Compliance   un-finalized inventories / menu mix + missed counts
   Every figure comes from the Deep Dive simulation (inv-deepdive-data.js):
     Store 007 - Encinitas · weekly count Sun 09/27 (Sep 21 – Sep 27):
     sales $48,511.76 · actual $13,918.01 · ideal $13,240.21 ·
     waste $296.00 · inventory $16,468.50 · deliveries $13,787.74
     Price Change Impact uses the Sep 30 monthly count (Aug 31 – Sep 30).
   Six-week trends = the weekly counts of Aug 23 (2-week count, Aug 16
   was missed), Aug 30, Sep 6, Sep 13, Sep 20, Sep 27.
   ============================================================ */

const AHUB_KPI_DATA = [
  /* 1 ---------------------------------------------------------------- */
  {
    id:'foodcost', label:'Act. Food Cost %', sbVal:'28.69%', sbVar:'▲ +1.40 pts vs ideal', sev:'al', sbTgt:'Ideal 27.29%',
    l1:{ eyebrow:'Act. Food Cost % · Week of Sep 21 – Sep 27 · 007 - Encinitas', val:'28.69%', valCls:'al',
      chip:'▲ 1.40 pts above the 27.29% ideal, double the usual gap', chipCls:'al', tgt:'',
      stats:[{lbl:'Actual Usage $',val:'$13,918.01',note:'Ideal $13,240.21',cls:'nm'},
             {lbl:'Variance $',val:'+$677.80',note:'Actual − ideal',cls:'al'},
             {lbl:'Sales $',val:'$48,511.76',note:'Week of Sep 21',cls:'nm'},
             {lbl:'Usual Gap',val:'0.65–0.70 pts',note:'Weekly counts Aug 23 – Sep 6',cls:'nm'}]},
    segs:[
      {key:'shrink', lbl:'Carne asada shrink', pct:26, amt:'$178.51', ov:'+9.3% vs recipe', ovCls:'al', col:'#1A3A6B'},
      {key:'portion', lbl:'Shrimp over-portioning', pct:19, amt:'$131.31', ov:'+12.6% vs recipe', ovCls:'al', col:'#2E5FA3'},
      {key:'avo', lbl:'Avocado spoilage', pct:17, amt:'$116.70', ov:'+11.0% vs recipe', ovCls:'al', col:'#5680BC'},
      {key:'cod', lbl:'Cod (within limit)', pct:18, amt:'$118.41', ov:'+3.1% vs recipe', ovCls:'nm', col:'#7393C4'},
      {key:'other', lbl:'All other items', pct:20, amt:'$132.87', ov:'+2.5% vs recipe', ovCls:'nm', col:'#9DB4D6'},
    ],
    ai:'Act. Food Cost % is <strong>28.69%, 1.40 pts above the 27.29% ideal</strong>. That is <strong>$677.80</strong> more than the menu mix and recipes call for, and double the 0.65–0.70 pt gap of a normal week. <strong>Three items over their variance limits account for $426.52</strong>: carne asada (+9.3% since Sep 22, almost none of it logged as waste), shrimp (+12.6%, heavy portions since Sep 8) and avocado (+11.0%, spoilage). Separately, vendor price increases lifted the ideal itself from 26.66% to 27.29%.',
    drivers:[
      { key:'shrink', n:1, sev:'al', seg:'shrink', icon:'beef', name:'Carne asada used 24.45 lb more than recipes call for', sub:'287.25 lb used vs 262.80 lb ideal (+9.3%, limit 4%). Only 2.25 lb was logged as waste.', impact:'+$178.51', impCls:'al',
        insight:'<strong>The gap starts on Mon Sep 22.</strong> Before that, carne asada mostly stayed within 0–5% of its recipe on daily counts. Since then every count has been 7–15% over. The Sysco price went down slightly over the same weeks. Extra usage that starts suddenly and holds steady points to product leaving without a record: staff meals, unlogged trim or theft.',
        subs:[
          { name:'Daily counts since Sep 22',
            cols:['Date','Actual','Ideal','Over','Waste Logged','Variance $'],
            rows:[['Tue 09/22','37.25 lb','32.51 lb',{v:'+14.6%',c:'tc-al'},'0.34 lb',{v:'$34.75',c:'tc-al'}],
                  ['Wed 09/23','34.75 lb','32.51 lb',{v:'+6.9%',c:'tc-wn'},'0.20 lb',{v:'$16.40',c:'tc-wn'}],
                  ['Thu 09/24','39.75 lb','36.32 lb',{v:'+9.4%',c:'tc-al'},'0.23 lb',{v:'$25.10',c:'tc-al'}],
                  ['Fri 09/25','51.50 lb','46.71 lb',{v:'+10.3%',c:'tc-al'},'0.37 lb',{v:'$35.02',c:'tc-al'}],
                  ['Sat 09/26','48.25 lb','43.58 lb',{v:'+10.7%',c:'tc-al'},'0.29 lb',{v:'$34.12',c:'tc-al'}],
                  ['Sun 09/27','44.75 lb','41.62 lb',{v:'+7.5%',c:'tc-wn'},'0.50 lb',{v:'$22.85',c:'tc-wn'}]]},
          { name:'Where carne asada is used (week of Sep 21)',
            cols:['Menu Item','Units Sold','Recipe','Ideal Usage'],
            rows:[['Carne Asada Taco','808','0.17 lb','137.36 lb'],
                  ['Carne Asada Burrito','392','0.32 lb','125.44 lb']]}
        ],
        fixRecs:['Count carne asada by weight at open and close for 3 days to find out whether the gap happens during service or overnight.',
                 'Log every staff meal and piece of trim, and lock the protein shelf in the walk-in after close.']},
      { key:'portion', n:2, sev:'al', seg:'portion', icon:'fish', name:'Shrimp portions are running 12.6% heavy', sub:'133.00 lb used vs 118.08 lb ideal. The Crispy Shrimp Taco recipe is 0.16 lb, and this week\'s tacos average about 0.18 lb.', impact:'+$131.31', impCls:'al',
        insight:'<strong>Shrimp jumped from ~3% to ~10% over recipe in the week of Sep 7 and has kept climbing.</strong> Waste is only 1.35 lb for the week, so the shrimp is going onto plates. A heavy hand at the fry station is the usual cause.',
        subs:[{ name:'Shrimp by weekly count', cols:['Week Ending','Actual','Ideal','Over Recipe','Variance $'],
          rows:[['Sun 08/30','137.50 lb','133.60 lb',{v:'+2.9%',c:'tc-nm'},'$35.09'],
                ['Sun 09/06','125.75 lb','122.40 lb',{v:'+2.7%',c:'tc-nm'},'$29.95'],
                ['Sun 09/13','140.50 lb','128.48 lb',{v:'+9.4%',c:'tc-al'},{v:'$106.49',c:'tc-al'}],
                ['Sun 09/20','136.75 lb','121.92 lb',{v:'+12.2%',c:'tc-al'},{v:'$130.52',c:'tc-al'}],
                ['Sun 09/27','133.00 lb','118.08 lb',{v:'+12.6%',c:'tc-al'},{v:'$131.31',c:'tc-al'}]]}],
        fixRecs:['Re-train the fry station on the 0.16 lb (2.5 oz) portion and use a fixed scoop. Back at 4%, this saves about $90 a week.']},
      { key:'avo', n:3, sev:'al', seg:'avo', icon:'leaf', name:'Avocado overuse is all spoilage: 102 avocados thrown out', sub:'988 used vs 889.9 ideal (+11.0%, limit 5%). 102.3 avocados were logged as spoiled, about the whole gap.', impact:'+$116.70', impCls:'al',
        insight:'<strong>Avocado waste went from about $35 a week to $120.85.</strong> It started on Sep 14, the same day FreshPoint\'s price rose 14%, and got worse after Sep 21. A min PAR of 552 avocados is about 4 days of use, so ripe fruit sits between deliveries.',
        subs:[{ name:'Avocado waste by weekly count', cols:['Week Ending','Waste $','FreshPoint Price'],
          rows:[['Sun 08/30','$35.39','$1.04'],['Sun 09/06','$30.24','$1.04'],['Sun 09/13','$38.58','$1.04'],
                ['Sun 09/20',{v:'$89.52',c:'tc-al'},{v:'$1.19',c:'tc-wn'}],['Sun 09/27',{v:'$120.85',c:'tc-al'},{v:'$1.24',c:'tc-al'}]]}],
        fixRecs:['Order for 2 days of sales instead of up to max PAR, and ask FreshPoint for firmer fruit (about $64 a week back to the 5% limit).']},
      { key:'cod', n:4, sev:'info', seg:'cod', icon:'fish', name:'Cod is within its 4% limit but large in dollars', sub:'588 lb used vs 570.28 lb ideal (+3.1%). Cod is the largest food cost line at $3,926.18 a week.', impact:'+$118.41', impCls:'nm',
        insight:'Cod has run 2.2–3.2% over recipe every week since August, which is normal fryer and thaw loss for this store. There is no new problem here, but because cod is so large, every 1% of yield is worth about $38 a week.',
        subs:[{ name:'Cod by weekly count', cols:['Week Ending','Over Recipe','Variance $'],
          rows:[['Sun 08/30','+2.9%','$116.46'],['Sun 09/06','+2.5%','$91.16'],['Sun 09/13','+2.2%','$84.92'],['Sun 09/20','+2.2%','$87.97'],['Sun 09/27','+3.1%','$118.41']]}]},
      { key:'price', n:5, sev:'wn', icon:'tag', name:'Vendor price increases lifted the ideal from 26.66% to 27.29%', sub:'Sysco cod +9.1% and FreshPoint avocado +19.6% since Sep 13, and Sysco cheese jumped 5.4% on Sep 21.', impact:'+0.63 pts ideal', impCls:'wn',
        insight:'Price increases don\'t create variance, because the ideal is costed at the same new prices, but they still push food cost up. See <strong>Price Change Impact</strong> for the full breakdown and the cheaper PFG cod option.'},
    ],
    recs:['Count carne asada at open and close for 3 days, log staff meals and trim, and lock the protein shelf after close (about $100 a week).',
          'Re-train the fry station on the 0.16 lb shrimp portion and add a scale (about $90 a week).',
          'Order avocados for 2 days of sales and ask FreshPoint for firmer fruit (about $64 a week).',
          'Move cod volume to PFG to offset the Sysco increase (up to about $315 a week).',
          'Finalize the Sep 27 weekly count so the week posts.']
  },

  /* 2 ---------------------------------------------------------------- */
  {
    id:'variance', label:'Variance %', sbVal:'1.40%', sbVar:'▲ +0.75 pts vs Sep 6', sev:'al', sbTgt:'Target 1.00% or less',
    l1:{ eyebrow:'Variance % · Week of Sep 21 – Sep 27 · 007 - Encinitas', val:'1.40%', valCls:'al',
      chip:'▲ 0.40 pts over the 1.00% target · $677.80 actual over ideal', chipCls:'al', tgt:'',
      stats:[{lbl:'Variance $',val:'+$677.80',note:'Actual $13,918.01 − ideal $13,240.21',cls:'al'},
             {lbl:'High Var. Items',val:'3',note:'Carne asada, shrimp, avocado',cls:'al'},
             {lbl:'Var. % of Ideal',val:'+5.1%',note:'Across 20 ingredients',cls:'wn'},
             {lbl:'Last Clean Week',val:'0.65%',note:'Week ending Sep 6',cls:'nm'}]},
    segs:[
      {key:'seafood', lbl:'Seafood', pct:41, amt:'$276.25', ov:'+4.8% of ideal', ovCls:'al', col:'#1A3A6B'},
      {key:'meat', lbl:'Meat & Poultry', pct:29, amt:'$197.06', ov:'+7.9% of ideal', ovCls:'al', col:'#2E5FA3'},
      {key:'produce', lbl:'Produce', pct:23, amt:'$157.54', ov:'+8.7% of ideal', ovCls:'al', col:'#5680BC'},
      {key:'other', lbl:'Dairy, tortillas, sauces & beverage', pct:7, amt:'$46.95', ov:'+1.5% of ideal', ovCls:'nm', col:'#8AA8CC'},
    ],
    ai:'Variance is <strong>1.40% of sales ($677.80)</strong>, above the 1.00% target and double the 0.65% of the week ending Sep 6. <strong>Seafood, meat and produce hold 93% of it</strong>, and inside them three items are over their variance limits: shrimp, carne asada and avocado. The two weeks before this one are not a fair comparison. A fountain syrup miscount on Sep 13 pushed the week ending Sep 13 to −0.40% and the week ending Sep 20 to 2.22%.',
    drivers:[
      { key:'seafood', n:1, sev:'al', seg:'seafood', icon:'fish', name:'Seafood: shrimp is 12.6% over recipe', sub:'Seafood is $276.25 over ideal. Shrimp accounts for $131.31; cod and mahi are within their 4% limits.', impact:'+$276.25', impCls:'al',
        insight:'<strong>Shrimp is the only seafood item past its limit.</strong> Cod (+3.1%) and mahi (+2.8%) are normal yield loss.',
        subs:[{ name:'Seafood items', cols:['Item','Actual $','Ideal $','Var. % of Ideal','Limit','Variance $'],
          rows:[['Shrimp 31/40 P&D','$1,170.53','$1,039.22',{v:'+12.6%',c:'tc-al'},'4%',{v:'$131.31',c:'tc-al'}],
                ['Pacific Cod Fillet','$3,926.18','$3,807.77',{v:'+3.1%',c:'tc-nm'},'4%','$118.41'],
                ['Mahi Mahi Portion','$977.98','$951.45',{v:'+2.8%',c:'tc-nm'},'4%','$26.53']]}],
        fixRecs:['Portion check and a 2.5 oz scoop at the fry station.']},
      { key:'meat', n:2, sev:'al', seg:'meat', icon:'beef', name:'Meat: carne asada is 9.3% over with no waste logged', sub:'Meat & Poultry is $197.06 over ideal, and $178.51 of it is carne asada.', impact:'+$197.06', impCls:'al',
        insight:'<strong>Carne asada went from about 2% to about 10% over recipe on Sep 22</strong> and has stayed there. Chicken is normal.',
        subs:[{ name:'Meat & Poultry items', cols:['Item','Actual $','Ideal $','Var. % of Ideal','Limit','Variance $'],
          rows:[['Carne Asada (Flap Meat)','$2,097.21','$1,918.70',{v:'+9.3%',c:'tc-al'},'4%',{v:'$178.51',c:'tc-al'}],
                ['Chicken Thigh Boneless','$599.20','$580.65',{v:'+3.2%',c:'tc-nm'},'4%','$18.55']]}],
        fixRecs:['Count at open and close for 3 days, and log staff meals and trim.']},
      { key:'produce', n:3, sev:'al', seg:'produce', icon:'leaf', name:'Produce: avocado spoilage, plus cilantro over its limit', sub:'Produce is $157.54 over ideal. Avocado is $116.70 of it; cilantro is 10.2% over (limit 8%) but small in dollars.', impact:'+$157.54', impCls:'al',
        insight:'<strong>Avocado\'s overuse is almost entirely logged spoilage</strong> (102 avocados). Cilantro moved at the same time, which also suggests a cooler or rotation problem.',
        subs:[{ name:'Produce items', cols:['Item','Var. % of Ideal','Limit','Waste $','Variance $'],
          rows:[['Hass Avocado',{v:'+11.0%',c:'tc-al'},'5%',{v:'$120.85',c:'tc-al'},{v:'$116.70',c:'tc-al'}],
                ['Green Cabbage Shredded','+5.7%','6%','$11.53','$16.55'],
                ['Limes 175 ct','+5.0%','8%','$7.11','$10.21'],
                ['Roma Tomato','+4.7%','6%','$5.37','$6.52'],
                ['Cilantro',{v:'+10.2%',c:'tc-wn'},'8%','$5.03','$5.72'],
                ['White Onion','+3.6%','6%','$0.94','$1.84']]}]},
      { key:'other', n:4, sev:'info', seg:'other', icon:'circle-check', name:'Dairy, tortillas, sauces and beverage are on recipe', sub:'+$46.95 combined. Fountain syrup reads $25.07 under ideal, as it does every week.', impact:'+$46.95', impCls:'nm',
        insight:'Every item in these categories is inside its limit. Fountain syrup runs about 5% under ideal every week, which suggests the 0.021 gal-per-drink recipe is set slightly high.',
        subs:[{ name:'Other categories', cols:['Item','Var. % of Ideal','Variance $'],
          rows:[['Mexican Crema','+3.6%','$21.93'],['Corn Tortilla 6"','+4.1%','$19.80'],['Monterey Jack Shredded','+3.0%','$13.27'],['Tortilla Chips','+2.5%','$6.93'],['Flour Tortilla 12"','+1.6%','$4.37'],['Salsa Verde','+1.6%','$3.26'],['Horchata','+0.8%','$1.36'],['Mayonnaise','+1.0%','$1.10'],['Fountain Syrup (BIB)',{v:'−4.5%',c:'tc-gd'},{v:'−$25.07',c:'tc-gd'}]]}]},
      { key:'count', n:5, sev:'wn', icon:'clipboard-x', name:'A syrup miscount distorted the weeks ending Sep 13 and Sep 20', sub:'9 BIBs were counted twice on Sep 13: −$684.64 variance that week and +$615.18 the next.', impact:'±$650', impCls:'wn',
        insight:'<strong>No product is missing.</strong> The two weeks net out, but the variance trend shows a false dip and a false spike. Treat Sep 6 (0.65%) as the last clean comparison.',
        subs:[{ name:'Fountain syrup variance', cols:['Week Ending','Actual','Ideal','Variance $'],
          rows:[['Sun 09/06','39.00 gal','40.17 gal','−$17.11'],['Sun 09/13',{v:'−5.50 gal',c:'tc-al'},'41.71 gal',{v:'−$684.64',c:'tc-al'}],['Sun 09/20',{v:'83.25 gal',c:'tc-al'},'40.47 gal',{v:'+$615.18',c:'tc-al'}],['Sun 09/27','37.25 gal','39.00 gal','−$25.07']]}]},
    ],
    recs:['Bring carne asada, shrimp and avocado back inside their limits. That takes variance to about 0.87%, under the 1.00% target.',
          'Recount any line with negative usage before finalizing, so a miscount can\'t post.',
          'Check cilantro and avocado rotation in the walk-in cooler.',
          'Review the fountain syrup recipe (0.021 gal per drink) against the fountain\'s brix setting.']
  },

  /* 3 ---------------------------------------------------------------- */
  {
    id:'waste', label:'Waste %', sbVal:'0.61%', sbVar:'▲ +0.20 pts vs Sep 6', sev:'wn', sbTgt:'Target 0.55% or less',
    l1:{ eyebrow:'Waste % · Week of Sep 21 – Sep 27 · 007 - Encinitas', val:'0.61%', valCls:'wn',
      chip:'▲ 0.06 pts over the 0.55% target · up from 0.41% three weeks ago', chipCls:'wn', tgt:'',
      stats:[{lbl:'Waste $',val:'$296.00',note:'On $48,511.76 sales',cls:'wn'},
             {lbl:'Avocado Waste',val:'$120.85',note:'41% of the week',cls:'al'},
             {lbl:'Normal Week',val:'$204–$227',note:'Weekly counts Aug 9 – Sep 13',cls:'nm'},
             {lbl:'Cod Waste',val:'$58.90',note:'Normal for this store',cls:'nm'}]},
    segs:[
      {key:'avo', lbl:'Hass Avocado', pct:41, amt:'$120.85', ov:'+$86 vs normal', ovCls:'al', col:'#1A3A6B'},
      {key:'cod', lbl:'Pacific Cod', pct:20, amt:'$58.90', ov:'normal', ovCls:'nm', col:'#2E5FA3'},
      {key:'prot', lbl:'Other proteins', pct:16, amt:'$47.80', ov:'normal', ovCls:'nm', col:'#5680BC'},
      {key:'prod', lbl:'Other produce', pct:10, amt:'$29.98', ov:'cilantro up', ovCls:'wn', col:'#7393C4'},
      {key:'rest', lbl:'Everything else', pct:13, amt:'$38.47', ov:'normal', ovCls:'nm', col:'#9DB4D6'},
    ],
    ai:'Waste is <strong>0.61% of sales ($296.00)</strong>, above the 0.55% target. It held at 0.41–0.42% for six weekly counts before rising in the week of Sep 14. <strong>Avocado is $120.85 of it, about $86 more than a normal week</strong>, all logged as Spoiled. Without the extra avocado waste the store would be at about 0.43%. Cod waste ($58.90) is normal.',
    drivers:[
      { key:'avo', n:1, sev:'al', seg:'avo', icon:'leaf', name:'Avocado spoilage tripled after Sep 14', sub:'102.3 avocados wasted this week, against about 30–37 a week in early September.', impact:'+$86 vs normal', impCls:'al',
        insight:'<strong>Waste per day went from about 4 avocados to 12–18.</strong> It started when FreshPoint\'s price rose 14% on Sep 14. The store now pays more per avocado and throws more away.',
        subs:[{ name:'Avocados wasted per day', cols:['Period','Wasted / Day','Waste $ / Day'],
          rows:[['Sep 1 – Sep 5','3.8','$3.93'],['Sep 14 – Sep 20',{v:'11.1',c:'tc-wn'},{v:'$12.79',c:'tc-wn'}],['Sep 21 – Sep 27',{v:'14.6',c:'tc-al'},{v:'$17.26',c:'tc-al'}],['Sep 28 – Sep 30',{v:'12.6',c:'tc-al'},{v:'$15.05',c:'tc-al'}]]}],
        fixRecs:['Order for 2 days of sales, rotate first-in first-out, and ask FreshPoint for firmer fruit.']},
      { key:'cod', n:2, sev:'info', seg:'cod', icon:'fish', name:'Cod waste is steady', sub:'$53–61 every week since August: thaw and fryer loss at a normal rate.', impact:'$58.90', impCls:'nm',
        insight:'There is no change to act on. Cod is the largest food line, so its normal waste is also the second-largest.'},
      { key:'prod', n:3, sev:'wn', seg:'prod', icon:'sprout', name:'Cilantro waste rose at the same time as avocado', sub:'9.2 bunches ($5.03) this week. The spoilage rate went from about 6% to 9% after Sep 14.', impact:'$5.03', impCls:'wn',
        insight:'It is small in dollars, but two produce items going bad from the same date suggests a walk-in cooler or rotation issue, not just one supplier.'},
    ],
    recs:['Fix avocado ordering and rotation. That takes waste back to about 0.43%.',
          'Check the walk-in cooler temperature log from Sep 14, since avocado and cilantro both started spoiling that week.',
          'Keep logging waste by reason. The Spoiled reason is what made this visible.']
  },

  /* 4 ---------------------------------------------------------------- */
  {
    id:'price', label:'Price Change Impact', sbVal:'+$1,494.78', sbVar:'▲ +2.14% weighted', sev:'wn', sbTgt:'Alert above 4% per item',
    l1:{ eyebrow:'Price Change Impact · September (monthly count Aug 31 – Sep 30) · 007 - Encinitas', val:'+$1,494.78', valCls:'wn',
      chip:'▲ Unit costs up 2.14% (usage-weighted) since the Aug 31 count', chipCls:'wn', tgt:'',
      stats:[{lbl:'Price Increases',val:'$2,086.17',note:'Extra paid on received qty',cls:'al'},
             {lbl:'Price Drops',val:'−$591.39',note:'14 items a little cheaper',cls:'gd'},
             {lbl:'Items Over 4% Alert',val:'3',note:'Cod, avocado, cheese',cls:'al'},
             {lbl:'September Purchases',val:'$69,581.10',note:'Monthly count deliveries',cls:'nm'}]},
    segs:[
      {key:'cod', lbl:'Cod (Sysco +9.1%)', pct:49, amt:'$1,031.40', ov:'from Sep 14', ovCls:'al', col:'#1A3A6B'},
      {key:'avo', lbl:'Avocado (FreshPoint +19.6%)', pct:34, amt:'$697.08', ov:'Sep 14 + Sep 24', ovCls:'al', col:'#2E5FA3'},
      {key:'small', lbl:'Mahi, cheese, chicken', pct:11, amt:'$223.60', ov:'+1.9% to +4.7%', ovCls:'wn', col:'#5680BC'},
      {key:'other', lbl:'Other small increases', pct:6, amt:'$134.09', ov:'under 2.5%', ovCls:'nm', col:'#8AA8CC'},
    ],
    ai:'Vendor prices added <strong>$1,494.78 net to September</strong>: $2,086.17 of increases, offset by $591.39 of small drops. <strong>Two increases are 83% of the total.</strong> Sysco raised cod 9.1% on Sep 14 ($6.34 → $6.91/lb), and FreshPoint raised avocados 19.6% across Sep 14 and Sep 24 ($1.04 → $1.24). Both have cheaper options already on file: <strong>PFG cod at $6.15/lb</strong> and <strong>Sysco 60-ct avocado at $1.02</strong>.',
    drivers:[
      { key:'cod', n:1, sev:'al', seg:'cod', icon:'fish', name:'Sysco cod fillet up 9.1% from Sep 14', sub:'$6.34 → $6.91/lb on the largest food line. Sysco supplies 70% of cod.', impact:'+$1,031.40', impCls:'al',
        insight:'<strong>PFG\'s cod loin barely moved ($6.21 → $6.15/lb)</strong> and is now $0.76/lb cheaper. Buying all of the Sysco share from PFG would save about $315 a week; flipping the split to 70% PFG saves about $180.',
        subs:[{ name:'Cod supplier items (September)', cols:['Supplier Item','Delivery','Sep 13','Sep 30','Received','Spend'],
          rows:[['Sysco · Cod Fillet 4 oz IQF','Mon · Wed · Fri','$6.34',{v:'$6.91',c:'tc-al'},'1,790 lb','$11,893.25'],
                ['PFG · Cod Loin 4–6 oz','Wed','$6.21',{v:'$6.15',c:'tc-gd'},'910 lb','$5,623.51']]}],
        fixRecs:['Trial PFG loin for a week on the Baja Fish Taco, then set PFG to 70% of cod.','Ask Sysco to match. The gap is about $300 a week.']},
      { key:'avo', n:2, sev:'al', seg:'avo', icon:'leaf', name:'FreshPoint avocado up 19.6%', sub:'+14% on Sep 14 and +3% on Sep 24 ($1.04 → $1.24 each). FreshPoint supplies 80% of avocados.', impact:'+$697.08', impCls:'al',
        insight:'<strong>Sysco\'s 60-ct avocado is $1.02</strong>, $0.22 under FreshPoint. The increase came with worse spoilage too (see Waste %).',
        subs:[{ name:'Avocado supplier items (September)', cols:['Supplier Item','Sep 13','Sep 30','Received','Spend'],
          rows:[['FreshPoint · Avocado Hass 48 ct','$1.04',{v:'$1.24',c:'tc-al'},'3,456 ea','$3,929.09'],
                ['Sysco · Avocado Hass 60 ct','$1.01',{v:'$1.02',c:'tc-gd'},'840 ea','$849.90']]}],
        fixRecs:['Move more of the avocado order to the Sysco 60-ct while FreshPoint\'s price is this high.']},
      { key:'small', n:3, sev:'wn', seg:'small', icon:'tag', name:'Mahi, cheese and chicken edged up', sub:'PFG mahi +1.9%, Sysco Monterey Jack +4.7% (a 5.4% jump on Sep 21), Sysco chicken +2.2%.', impact:'+$223.60', impCls:'wn',
        insight:'Only cheese crossed the 4% price alert. Ask Sysco whether the Sep 21 jump is a market move or a lapsed contract price.'},
      { key:'drops', n:4, sev:'info', icon:'trending-down', name:'Price drops offset $591.39', sub:'Carne asada (−2.3%), shrimp (−1.9%), crema, beans and fountain syrup got slightly cheaper.', impact:'−$591.39', impCls:'gd',
        insight:'These are normal small swings. Carne asada getting cheaper also rules out price as the reason for its variance.'},
    ],
    recs:['Trial PFG cod loin, then move 70% of cod to PFG (about $180 a week).',
          'Shift avocado volume to the Sysco 60-ct while FreshPoint is at $1.24.',
          'Ask Sysco about the Sep 21 cheese increase.',
          'Review the price alert list after every invoice, not just at the monthly count.']
  },

  /* 5 ---------------------------------------------------------------- */
  {
    id:'doh', label:'Days on Hand', sbVal:'8.3 days', sbVar:'▲ +1.3 days over target', sev:'wn', sbTgt:'Target 7 days or fewer',
    l1:{ eyebrow:'Days on Hand · Sep 27 weekly count · 007 - Encinitas', val:'8.3 days', valCls:'wn',
      chip:'▲ 1.3 days more stock than a 7-day cover needs', chipCls:'wn', tgt:'',
      stats:[{lbl:'Inventory $',val:'$16,468.50',note:'Weekly-count items',cls:'nm'},
             {lbl:'Avg Daily Usage',val:'$1,988.29',note:'Actual $13,918.01 ÷ 7',cls:'nm'},
             {lbl:'Above a 7-Day Cover',val:'$2,550.47',note:'Store-wide',cls:'wn'},
             {lbl:'3 Slow Items',val:'$4,128.65',note:'Syrup, cheese, mahi',cls:'wn'}]},
    segs:[
      {key:'seafood', lbl:'Seafood', pct:41, amt:'$6,780.85', ov:'7.8 days', ovCls:'wn', col:'#1A3A6B'},
      {key:'meat', lbl:'Meat & Poultry', pct:12, amt:'$1,898.78', ov:'4.9 days', ovCls:'gd', col:'#2E5FA3'},
      {key:'bev', lbl:'Beverage', pct:11, amt:'$1,840.64', ov:'18.3 days', ovCls:'al', col:'#3F6CAE'},
      {key:'dairy', lbl:'Dairy & Cheese', pct:11, amt:'$1,823.53', ov:'11.7 days', ovCls:'wn', col:'#5680BC'},
      {key:'produce', lbl:'Produce', pct:10, amt:'$1,729.09', ov:'6.2 days', ovCls:'gd', col:'#7393C4'},
      {key:'tortilla', lbl:'Tortillas & Chips', pct:10, amt:'$1,602.81', ov:'10.5 days', ovCls:'wn', col:'#8AA8CC'},
      {key:'sauce', lbl:'Sauces', pct:5, amt:'$792.80', ov:'17.2 days', ovCls:'wn', col:'#AFC3E0'},
    ],
    ai:'The store holds <strong>$16,468.50 of stock, 8.3 days</strong> at this week\'s usage, against a 7-day target. Proteins and produce turn quickly (4–8 days). <strong>The excess sits in three items: fountain syrup (20.6 days), Monterey Jack (16.2) and mahi (10.8)</strong>, $4,128.65 together. Trimming them to a 7-day cover frees about <strong>$2,160</strong> of cash.',
    drivers:[
      { key:'bev', n:1, sev:'al', seg:'bev', icon:'cup-soda', name:'Fountain syrup: 20.6 days on hand', sub:'109.5 gal on hand after a 75 gal delivery on Sep 22, against about 37–40 gal a week of use.', impact:'$1,568.70', impCls:'al',
        insight:'<strong>Syrup is ordered in large drops while usage is steady.</strong> Skipping one weekly Pepsi delivery brings it back near 14 days.',
        subs:[{ name:'Beverage items', cols:['Item','On Hand','On Hand $','Days on Hand'],
          rows:[['Fountain Syrup (BIB)','109.5 gal','$1,568.70',{v:'20.6',c:'tc-al'}],['Horchata Concentrate','24 gal','$271.94',{v:'11.2',c:'tc-wn'}]]}],
        fixRecs:['Skip the next Pepsi syrup delivery and lower the max PAR.']},
      { key:'dairy', n:2, sev:'wn', seg:'dairy', icon:'milk', name:'Monterey Jack: 16.2 days on hand', sub:'240.75 lb on hand at about 101 lb a week. Sysco delivers it on Thursdays in 20 lb cases.', impact:'$1,054.24', impCls:'wn',
        insight:'Cheese keeps, but two weeks of stock ties up cash at the new, higher Sysco price.',
        subs:[{ name:'Dairy items', cols:['Item','On Hand','On Hand $','Days on Hand'],
          rows:[['Monterey Jack Shredded','240.75 lb','$1,054.24',{v:'16.2',c:'tc-al'}],['Mexican Crema','228.75 lb','$769.29',{v:'8.5',c:'tc-wn'}]]}],
        fixRecs:['Set the cheese max PAR to about 100 lb (7 days).']},
      { key:'seafood', n:3, sev:'info', seg:'seafood', icon:'fish', name:'Mahi holds 10.8 days because PFG delivers once a week', sub:'155.5 lb on hand. Cod (7.3 days) and shrimp (6.9 days) are fine.', impact:'$1,505.71', impCls:'nm',
        insight:'With one delivery a week, 10–11 days is the minimum safe cover for mahi. It can come down if PFG adds a second day, which also helps the cod switch.',
        subs:[{ name:'Seafood items', cols:['Item','On Hand $','Days on Hand'],
          rows:[['Pacific Cod Fillet','$4,117.81','7.3'],['Mahi Mahi Portion','$1,505.71',{v:'10.8',c:'tc-wn'}],['Shrimp 31/40 P&D','$1,157.33','6.9']]}]},
      { key:'tortilla', n:4, sev:'info', seg:'tortilla', icon:'package', name:'Corn tortillas and chips run 11–13 days', sub:'Corn tortilla 11.3 days ($817.79), chips 13.4 days ($550.40). Both are shelf-stable.', impact:'$1,602.81', impCls:'nm',
        insight:'These are low-risk to hold. Flour tortillas went the other way and fell below PAR after a short-ship (see Below PAR Items).'},
    ],
    recs:['Skip one Pepsi syrup delivery and lower its max PAR (frees about $1,035).',
          'Set the Monterey Jack max PAR to 7 days (frees about $599).',
          'Ask PFG for a second delivery day, which lets mahi come down and supports the cod switch.',
          'Monthly count: foil sheets still hold about 70 days of stock after the Aug 27 over-order. Hold off on reordering.']
  },

  /* 6 ---------------------------------------------------------------- */
  {
    id:'belowpar', label:'Below PAR Items', sbVal:'2 items', sbVar:'▲ + 2 short-shipped lines', sev:'al', sbTgt:'Target 0',
    l1:{ eyebrow:'Below PAR Items · Sep 27 weekly count · 007 - Encinitas', val:'2 items', valCls:'al',
      chip:'▲ Flour tortillas and limes closed under min PAR · 2 US Foods short-ships', chipCls:'al', tgt:'',
      stats:[{lbl:'Weekly Deliveries $',val:'$13,787.74',note:'28.4% of sales',cls:'nm'},
             {lbl:'Short-Shipped Lines',val:'2',note:'Both US Foods',cls:'al'},
             {lbl:'Not Received',val:'$317.35',note:'Tortillas $279.55 + crema $37.80',cls:'al'},
             {lbl:'Transfers In',val:'$81.96',note:'Cod + tortillas from 012 - Carlsbad',cls:'wn'}]},
    segs:[
      {key:'flour', lbl:'Flour tortilla (0 of 14 cases)', pct:88, amt:'$279.55', ov:'0% fill', ovCls:'al', col:'#1A3A6B'},
      {key:'crema', lbl:'Mexican crema (7 of 8 cases)', pct:12, amt:'$37.80', ov:'87.5% fill', ovCls:'wn', col:'#5680BC'},
    ],
    ai:'Two items closed the Sep 27 count under min PAR. <strong>Flour tortillas are the real problem</strong>: US Foods sent <strong>0 of 14 cases</strong> on Fri Sep 25, so the store ran the weekend down to 1,128 against a 1,365 min PAR and borrowed 96 from Carlsbad. Limes closed 2 under PAR, which is just timing. US Foods also shorted crema by a case on Sep 22. Its fill rate this week was 87.4%, against 100% for every other supplier.',
    checks:[
      {lbl:'Flour Tortilla 12" at or above min PAR', v:'1,128 / 1,365', ok:false},
      {lbl:'Limes 175 ct at or above min PAR', v:'1,594 / 1,596', ok:false},
      {lbl:'US Foods fill rate 95% or better', v:'87.4%', ok:false},
      {lbl:'Sysco, PFG, FreshPoint, Pepsi fill rate', v:'100%', ok:true},
      {lbl:'Proteins at or above min PAR', v:'5 of 5', ok:true},
      {lbl:'Transfers in finalized', v:'2 of 2', ok:true},
    ],
    drivers:[
      { key:'flour', n:1, sev:'al', seg:'flour', icon:'package-x', name:'Flour tortillas: 0 of 1,344 delivered on Sep 25', sub:'On hand went 1,461 (Fri) → 1,128 (Sun count) → 977 (Mon). The Tue Sep 29 delivery of 1,920 restocked it.', impact:'1,128 / 1,365 PAR', impCls:'al',
        insight:'<strong>Every burrito and the Kids Quesadilla uses one,</strong> 150–220 a day. Without the 96 from Carlsbad the store would have been close to 880 by the Mon close.',
        subs:[{ name:'Flour tortilla on hand by day', cols:['Date','Ordered','Received','Transfer In','Closing On Hand'],
          rows:[['Fri 09/25','1,344',{v:'0',c:'tc-al'},'—','1,461'],['Sat 09/26','—','—','96',{v:'1,339',c:'tc-wn'}],['Sun 09/27 (count)','—','—','—',{v:'1,128',c:'tc-al'}],['Mon 09/28','—','—','—',{v:'977',c:'tc-al'}],['Tue 09/29','1,920',{v:'1,920',c:'tc-gd'},'—','2,746']]}],
        fixRecs:['Escalate with US Foods and ask for a no-ship alert.','Order one case above max PAR on Fridays until the fill rate recovers.']},
      { key:'crema', n:2, sev:'wn', seg:'crema', icon:'milk', name:'Mexican crema: 7 of 8 cases on Sep 22', sub:'78.75 lb received of 90 lb ordered. On hand stayed above PAR (228.75 lb vs 197.56 lb).', impact:'87.5% fill', impCls:'wn',
        insight:'No stock-out, but it is the same supplier and the same week as the tortilla short-ship.'},
      { key:'lime', n:3, sev:'info', icon:'citrus', name:'Limes closed 2 under PAR, which is timing only', sub:'1,594 vs 1,596 at the Sunday count. FreshPoint delivers again Monday.', impact:'−2 ea', impCls:'nm',
        insight:'No action needed. Limes are delivered three times a week and were received in full.'},
    ],
    recs:['Escalate both short-ships with the US Foods rep and ask for an alert when an item won\'t ship.',
          'Raise the Friday flour tortilla order by one case until US Foods\' fill rate is back above 95%.',
          'Settle the two transfers in from 012 - Carlsbad ($81.96).',
          'Set up a back-up flour tortilla item with another supplier.']
  },

  /* 7 ---------------------------------------------------------------- */
  {
    id:'counts', label:'Count Compliance', sbVal:'3 open', sbVar:'2 daily counts missed in Sep', sev:'wn', sbTgt:'Target 0 open',
    l1:{ eyebrow:'Count Compliance · as of Oct 1, 2026 · 007 - Encinitas', val:'3 open', valCls:'wn',
      chip:'2 inventories + 1 menu mix waiting to be finalized', chipCls:'wn', tgt:'',
      stats:[{lbl:'Un-Finalized Inventories',val:'2',note:'Weekly Sep 27 · Daily Sep 30',cls:'wn'},
             {lbl:'Un-Finalized Menu Mix',val:'1',note:'Sep 30',cls:'wn'},
             {lbl:'Missed Daily Counts',val:'2',note:'Sun Sep 6 · Sun Sep 20',cls:'al'},
             {lbl:'Count Errors',val:'1',note:'Syrup counted twice, Sep 13',cls:'al'}]},
    segs:[
      {key:'inv', lbl:'Un-finalized inventories', pct:34, amt:'2', ov:'Sep 27 · Sep 30', ovCls:'wn', col:'#1A3A6B'},
      {key:'mm', lbl:'Un-finalized menu mix', pct:16, amt:'1', ov:'Sep 30', ovCls:'wn', col:'#2E5FA3'},
      {key:'miss', lbl:'Missed daily counts', pct:34, amt:'2', ov:'both Sundays', ovCls:'al', col:'#5680BC'},
      {key:'err', lbl:'Count errors', pct:16, amt:'1', ov:'syrup, Sep 13', ovCls:'al', col:'#8AA8CC'},
    ],
    ai:'<strong>The Sep 27 weekly count is not finalized</strong>, so this week\'s food cost and variance are still provisional and won\'t post to the dashboard trend. The Sep 30 daily count and menu mix are also open. In September the store <strong>skipped two Sunday daily counts (Sep 6 and Sep 20)</strong>, and the Sep 13 weekly count listed 9 syrup BIBs twice, which distorted two weeks of variance.',
    checks:[
      {lbl:'Weekly count Sun 09/27 finalized', v:'Un-Finalized', ok:false},
      {lbl:'Daily count Wed 09/30 finalized', v:'Un-Finalized', ok:false},
      {lbl:'Menu mix Wed 09/30 finalized', v:'Un-Finalized', ok:false},
      {lbl:'Daily count every day in September', v:'28 of 30', ok:false},
      {lbl:'No negative-usage lines on finalized counts', v:'1 (Sep 13)', ok:false},
      {lbl:'Monthly count Sep 30 finalized', v:'Finalized', ok:true},
      {lbl:'Transfers in finalized', v:'2 of 2', ok:true},
    ],
    drivers:[
      { key:'inv', n:1, sev:'wn', seg:'inv', icon:'clipboard-list', name:'The Sep 27 weekly count has 11 warnings to clear', sub:'22 items counted. 4 high variance, 2 high waste, 2 below PAR, 2 short-shipped, 1 price alert.', impact:'2 open', impCls:'wn',
        insight:'<strong>Review the warnings, then finalize.</strong> Every one of them is explained in the Insights list, so none needs a recount.',
        subs:[{ name:'Open inventories', cols:['Inventory','Frequency','Items','Warnings','Status'],
          rows:[['Sun 09/27','Weekly','22','11',{v:'Un-Finalized',c:'tc-wn'}],['Wed 09/30','Daily','8','4',{v:'Un-Finalized',c:'tc-wn'}]]}]},
      { key:'miss', n:2, sev:'al', seg:'miss', icon:'calendar-x', name:'Daily counts missed on two Sundays', sub:'Sep 6 and Sep 20. Each following count covered 2 days.', impact:'2 missed', impCls:'al',
        insight:'A 2-day count can\'t show which day a loss happened. That matters this month, with carne asada shrink starting on Sep 22, right after the missed Sep 20 count.',
        fixRecs:['Add the daily count to the Sunday closing checklist.']},
      { key:'err', n:3, sev:'al', seg:'err', icon:'clipboard-x', name:'Sep 13: 9 syrup BIBs counted twice', sub:'155 gal recorded against about 110 on the shelf, which created negative usage, then a spike.', impact:'±$650', impCls:'al',
        insight:'A negative-usage line on a count is always a counting error. Block finalizing until it is recounted.'},
    ],
    recs:['Finalize the Sep 27 weekly count today, then the Sep 30 daily count and menu mix.',
          'Put the Sunday daily count on the closing checklist.',
          'Count beverage by storage location so BIBs aren\'t listed twice.',
          'Require a recount for any negative-usage line before finalizing.']
  },
];

const AHUB_IMPACT_DATA = {
  foodcost: {
    charts:[
      { title:'Act. Food Cost % · 6 weekly counts', values:[27.23,27.39,27.31,26.17,29.40,28.69], lastVal:'28.69%', cls:'al', col:'#ef4444' },
      { title:'Gap to ideal (pts) · 6 weekly counts', values:[0.66,0.70,0.65,-0.40,2.22,1.40], lastVal:'+1.40 pts', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Act. Food Cost %', val:'28.69%', chg:'▲ 1.40 pts vs ideal', cls:'al' },
      { lbl:'Ideal Food Cost %', val:'27.29%', chg:'▲ 0.63 pts vs Sep 6', cls:'wn' },
      { lbl:'Items over limit', val:'$426.52', chg:'3 items', cls:'al' },
    ]
  },
  variance: {
    charts:[
      { title:'Variance % · 6 weekly counts', values:[0.66,0.70,0.65,-0.40,2.22,1.40], lastVal:'1.40%', cls:'al', col:'#ef4444' },
      { title:'Variance $ by category', values:[276.25,197.06,157.54,35.20,31.10,4.36,-23.71], lastVal:'Seafood $276', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Variance %', val:'1.40%', chg:'▲ 0.40 pts over target', cls:'al' },
      { lbl:'Variance $', val:'$677.80', chg:'▲ $354 vs Sep 6', cls:'al' },
      { lbl:'High Var. Items', val:'3', chg:'Target 0', cls:'al' },
    ]
  },
  waste: {
    charts:[
      { title:'Waste % · 6 weekly counts', values:[0.42,0.42,0.41,0.42,0.53,0.61], lastVal:'0.61%', cls:'wn', col:'#f59e0b' },
      { title:'Avocado waste $ · 5 weeks', values:[35.39,30.24,38.58,89.52,120.85], lastVal:'$120.85', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Waste %', val:'0.61%', chg:'▲ 0.06 pts over target', cls:'wn' },
      { lbl:'Waste $', val:'$296.00', chg:'▲ $92 vs Sep 6', cls:'wn' },
      { lbl:'Avocado share', val:'41%', chg:'▲ from 15%', cls:'al' },
    ]
  },
  price: {
    charts:[
      { title:'Price Change Impact $ · 3 monthly counts', values:[-226.11,344.39,1494.78], lastVal:'$1,494.78', cls:'wn', col:'#f59e0b' },
      { title:'Sysco cod $/lb · Aug 31 → Sep 30', values:[6.35,6.34,6.79,6.89,6.91], lastVal:'$6.91', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Weighted price change', val:'+2.14%', chg:'▲ vs Aug +0.48%', cls:'wn' },
      { lbl:'Cod: Sysco vs PFG', val:'$0.76/lb', chg:'PFG cheaper', cls:'gd' },
      { lbl:'Avocado: FreshPoint vs Sysco', val:'$0.22/ea', chg:'Sysco cheaper', cls:'gd' },
    ]
  },
  doh: {
    charts:[
      { title:'Days on Hand · 6 weekly counts', values:[7.62,7.62,8.28,8.90,7.84,8.28], lastVal:'8.3 days', cls:'wn', col:'#f59e0b' },
      { title:'Inventory $ · 6 weekly counts', values:[16011.55,16069.29,16139.54,17214.26,16395.72,16468.50], lastVal:'$16,468.50', cls:'nm', col:'#64748b' },
    ],
    vs:[
      { lbl:'Days on Hand', val:'8.3 days', chg:'▲ 1.3 over target', cls:'wn' },
      { lbl:'Cash to free (3 items)', val:'$2,161.80', chg:'At 7-day cover', cls:'gd' },
      { lbl:'Slowest item', val:'Syrup 20.6 d', chg:'▲ 13.6 days', cls:'al' },
    ]
  },
  belowpar: {
    charts:[
      { title:'Items below PAR · 6 weekly counts', values:[2,2,1,1,2,2], lastVal:'2', cls:'al', col:'#ef4444' },
      { title:'Flour tortillas on hand · Sep 22 → 30', values:[2028,1864,1683,1461,1339,1124,977,2746,2578], lastVal:'2,578', cls:'gd', col:'#22c55e' },
    ],
    vs:[
      { lbl:'Below PAR items', val:'2', chg:'Target 0', cls:'al' },
      { lbl:'US Foods fill rate', val:'87.4%', chg:'▼ under 95%', cls:'al' },
      { lbl:'Other suppliers', val:'100%', chg:'On target', cls:'gd' },
    ]
  },
  counts: {
    charts:[
      { title:'Count warnings · 6 weekly counts', values:[2,3,1,5,9,11], lastVal:'11', cls:'wn', col:'#f59e0b' },
      { title:'Open items · now', values:[2,1,2,1], lastVal:'3 open', cls:'wn', col:'#f59e0b' },
    ],
    vs:[
      { lbl:'Un-finalized inventories', val:'2', chg:'Finalize today', cls:'wn' },
      { lbl:'Daily counts (Sep)', val:'28 of 30', chg:'2 missed', cls:'al' },
      { lbl:'Count errors', val:'1', chg:'Sep 13 syrup', cls:'al' },
    ]
  },
};

if (typeof window !== 'undefined') {
  window.AHUB_KPI_DATA = AHUB_KPI_DATA;
  window.AHUB_IMPACT_DATA = AHUB_IMPACT_DATA;
}

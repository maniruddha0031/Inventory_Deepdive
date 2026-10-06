/* ============================================================
   Inventory Insight — Insights tab data
   Same shape as Schedule Insight's insights-nui-data.js:
   {id, group, badge, badgeText, title, meta, chips[], rootCause,
    tableLabel, tableSub, tableHeaders[], tableRows[], tableRowDesc?[],
    tableRowIcon?[], recommendation, actions[]}  (rendered by
   insights-render.js).

   Every figure is taken from the Deep Dive simulation
   (inv-deepdive-data.js), so both tabs reconcile:
     Daily   = the Wed 09/30 daily count (proteins + avocado)
     Weekly  = the Sun 09/27 weekly count, week of Sep 21 – Sep 27
               (sales $48,511.76 · actual $13,918.01 · ideal $13,240.21)
     Price   = the Sep 30 monthly count (Aug 31 – Sep 30)
   KPI definitions follow HubWorks Zip Inventory (HW Release):
     Act. Food Cost % = actual usage $ ÷ sales      (EOInvMain)
     Variance         = actual − ideal (ACTMINTHEO) (EOInvFinDetail)
     Waste %          = waste $ ÷ sales
     Days on hand     = inventory $ ÷ avg daily actual usage $
   badge: 'sev-good' (Opportunity) | 'sev-warn' (Warning) |
          'sev-alert' (Alert) | 'sev-info' (Info)
   ============================================================ */

const SI_INS_ALL = [
  /* ---------------- DAILY (Wed 09/30 daily count) ---------------- */
  {
    id:0, group:'daily', badge:'sev-alert', badgeText:'Alert',
    title:'Shrimp usage ran 17.6% over recipe on Sep 30 — re-check the Crispy Shrimp Taco portion (0.16 lb)',
    meta:'Wed 09/30 daily count · 17.50 lb used vs 14.88 lb ideal · variance limit 4%',
    chips:[{l:'Actual Usage',v:'17.50 lb',c:''},{l:'Ideal Usage',v:'14.88 lb',c:''},{l:'Over Recipe',v:'+17.6%',c:'neg'},{l:'Variance $',v:'+$23.10',c:'neg'}],
    rootCause:'Shrimp goes into one menu item, the Crispy Shrimp Taco, at 0.16 lb per taco. Up to Sep 7 shrimp ran 1–6% over ideal, inside its 4% limit. From Sep 8 every daily count has been 6–19% over, and the gap is widening: about 10% over in the week of Sep 8 and about 13% over since Sep 22. Only 0.1–0.3 lb a day is logged as waste, so the extra shrimp is going onto plates, not into the bin. That points to heavy portioning at the fry station.',
    tableLabel:'Daily Shrimp Usage vs Recipe', tableSub:'Last 7 daily counts · actual vs ideal (menu mix × recipe)',
    tableHeaders:['Count Date','Actual','Ideal','Over Recipe','Variance $'],
    tableRowIcon:['calendar','calendar','calendar','calendar','calendar','calendar','calendar'],
    tableRows:[
      ['Thu 09/24','18.25 lb','16.48 lb','+10.7%','$15.56'],
      ['Fri 09/25','23.00 lb','20.32 lb','+13.2%','$23.58'],
      ['Sat 09/26','22.50 lb','18.88 lb','+19.2%','$31.84'],
      ['Sun 09/27','20.75 lb','19.04 lb','+9.0%','$15.05'],
      ['Mon 09/28','14.25 lb','12.64 lb','+12.7%','$14.18'],
      ['Tue 09/29','14.75 lb','13.28 lb','+11.1%','$12.96'],
      ['Wed 09/30','17.50 lb','14.88 lb','+17.6%','$23.10'],
    ],
    recommendation:'Re-train the fry station on the 0.16 lb (2.5 oz) shrimp portion and put a scale at the station. Getting shrimp back to its 4% limit saves about $90 a week.',
    actions:[
      {title:'Portion check on the next shift (~$90/week)', body:'Weigh 5 tacos as they leave the fry station. The recipe is 0.16 lb; this week\'s usage works out to about 0.18 lb a taco.'},
      {title:'Switch to a 2.5 oz portion scoop', body:'A fixed scoop stops the drift that started on Sep 8, when the gap went from ~3% to ~10%.'},
      {title:'Watch the next 3 daily counts', body:'If shrimp is still over 4% after the portion check, count the walk-in freezer at open and close to rule out shrink.'},
    ],
  },
  {
    id:1, group:'daily', badge:'sev-alert', badgeText:'Alert',
    title:'Carne asada is 10.9% over recipe on Sep 30 — the 9th count in a row above its 4% limit, with almost nothing logged as waste',
    meta:'Wed 09/30 daily count · 37.50 lb used vs 33.81 lb ideal · Sep 22 – Sep 30 average +10.3%',
    chips:[{l:'Over Recipe (Sep 30)',v:'+10.9%',c:'neg'},{l:'Unexplained Usage (9 counts)',v:'+33.19 lb',c:'neg'},{l:'Variance $ (9 counts)',v:'$242.58',c:'neg'},{l:'Waste Logged (9 counts)',v:'2.80 lb',c:''}],
    rootCause:'Until Sep 21 carne asada mostly stayed within 0–5% of its recipe on daily counts. From Mon Sep 22 every count is 7–15% over. That is 33.19 lb more than the Carne Asada Taco and Burrito sales explain across 9 counts, and only 2.80 lb of it was logged as waste. The Sysco price went down slightly over the same weeks, so neither price nor recipe explains it. Extra usage that starts suddenly and stays level usually means product is leaving without a record: staff meals, trim that isn\'t logged, or theft.',
    tableLabel:'Carne Asada — Daily Counts Since the Jump', tableSub:'Actual vs ideal usage and logged waste, Sep 22 – Sep 30',
    tableHeaders:['Count Date','Actual','Ideal','Over Recipe','Waste Logged','Variance $'],
    tableRowIcon:['calendar','calendar','calendar','calendar','calendar','calendar','calendar','calendar','calendar'],
    tableRows:[
      ['Tue 09/22','37.25 lb','32.51 lb','+14.6%','0.34 lb','$34.75'],
      ['Wed 09/23','34.75 lb','32.51 lb','+6.9%','0.20 lb','$16.40'],
      ['Thu 09/24','39.75 lb','36.32 lb','+9.4%','0.23 lb','$25.10'],
      ['Fri 09/25','51.50 lb','46.71 lb','+10.3%','0.37 lb','$35.02'],
      ['Sat 09/26','48.25 lb','43.58 lb','+10.7%','0.29 lb','$34.12'],
      ['Sun 09/27','44.75 lb','41.62 lb','+7.5%','0.50 lb','$22.85'],
      ['Mon 09/28','31.75 lb','27.91 lb','+13.8%','0.30 lb','$28.02'],
      ['Tue 09/29','34.00 lb','31.34 lb','+8.5%','0.20 lb','$19.41'],
      ['Wed 09/30','37.50 lb','33.81 lb','+10.9%','0.37 lb','$26.91'],
    ],
    recommendation:'Treat this as shrink until it is ruled out. Count carne asada by weight at open and close, log every staff meal and piece of trim, and lock the protein shelf in the walk-in after close. Back at the 4% limit, carne asada costs about $100 a week less.',
    actions:[
      {title:'Count carne asada at open and close for 3 days', body:'Splitting the day shows whether the gap happens during service (portioning) or overnight (product leaving).'},
      {title:'Log every staff meal and prep trim', body:'Only 2.80 lb of waste was logged in 9 counts. The other 30+ lb has no record.'},
      {title:'Check Sysco deliveries against what was put away', body:'Weigh the Sep 25 (180 lb) and Sep 28 (120 lb) deliveries against the invoice to rule out a receiving gap.'},
    ],
  },
  {
    id:2, group:'daily', badge:'sev-warn', badgeText:'Warning',
    title:'Avocado waste is over 3x normal — 13.6 avocados thrown out on Sep 30 while FreshPoint\'s price is up 19.6%',
    meta:'Wed 09/30 · 138 used vs 118.25 ideal (+16.6%) · 13.6 ea logged as spoiled ($16.30)',
    chips:[{l:'Wasted (Sep 30)',v:'13.6 ea',c:'neg'},{l:'Waste $ (Sep 30)',v:'$16.30',c:'neg'},{l:'Waste $ (Sep 24 – Sep 30)',v:'$123.17',c:'neg'},{l:'FreshPoint Price vs Sep 13',v:'+19.6%',c:'neg'}],
    rootCause:'In early September the store threw out about 4 avocados a day. From Sep 14 that rose to about 11 a day, and since Sep 21 it has been 12–18 a day, all logged as Spoiled, so the fruit is going bad before the line uses it. Sep 14 is also when FreshPoint\'s 48-ct avocado went up 14%, plus another 3% on Sep 24 ($1.04 → $1.24). The store now pays more per avocado and throws away more of them. Min PAR is 552 avocados, about 4 days of use, which leaves ripe fruit sitting in the cooler between the Mon, Wed and Sat deliveries.',
    tableLabel:'Avocado Waste per Day', tableSub:'Avocados logged as waste per day and the $ lost',
    tableHeaders:['Period','Wasted / Day (ea)','Waste $ / Day'],
    tableRowIcon:['calendar','calendar','calendar','calendar','calendar','calendar'],
    tableRowDesc:['Before the price increase','FreshPoint +14% from Sep 14','FreshPoint +3% more from Sep 24','','',''],
    tableRows:[
      ['Sep 1 – Sep 5 (avg)','3.8','$3.93/day'],
      ['Sep 14 – Sep 20 (avg)','11.1','$12.79/day'],
      ['Sep 21 – Sep 27 (avg)','14.6','$17.26/day'],
      ['Mon 09/28','11.8','$14.11/day'],
      ['Tue 09/29','12.3','$14.73/day'],
      ['Wed 09/30','13.6','$16.30/day'],
    ],
    recommendation:'Order avocados for 2 days of sales, not up to max PAR, and ask FreshPoint for firmer fruit. Back at early-September waste, the store saves about $13 a day, roughly $90 a week at today\'s price.',
    actions:[
      {title:'Order to the 2-day need', body:'Avocados arrive Mon · Wed · Sat. A 552-avocado min PAR is about 4 days of use, so ripe fruit waits too long.'},
      {title:'Ask FreshPoint for a credit and firmer fruit', body:'Price is up 19.6% since Sep 13 ($1.04 → $1.24 an avocado) at the same time quality dropped.'},
      {title:'Rotate first-in, first-out', body:'Stage only what the line uses today. Keep tomorrow\'s fruit cold and unripened.'},
    ],
  },
  {
    id:3, group:'daily', badge:'sev-info', badgeText:'Info',
    title:'The Sep 30 daily count and the Sep 27 weekly count are still un-finalized — finalize them so the week posts',
    meta:'2 inventories + 1 menu mix awaiting finalize · daily counts were also missed on Sun Sep 20 and Sun Sep 6',
    chips:[{l:'Un-Finalized Inventories',v:'2',c:'neg'},{l:'Un-Finalized Menu Mix',v:'1',c:''},{l:'Missed Daily Counts (Sep)',v:'2',c:'neg'},{l:'Warnings on Sep 27 Count',v:'11',c:''}],
    rootCause:'Food cost and variance post from finalized inventories, and the dashboard trend uses posted weekly counts. The Sep 27 weekly count (22 items) is counted but not finalized, so the weekly numbers on this page are still provisional. The Sep 30 daily count and the Sep 30 menu mix are also open. Separately, no daily count was taken on Sun Sep 20 or Sun Sep 6. The next count covered two days each time, so a loss on either day can\'t be traced to one day.',
    tableLabel:'Open Inventory Tasks', tableSub:'What still needs to be finalized or counted',
    tableHeaders:['Task','Detail'],
    tableRows:[
      ['Finalize the weekly count — Sun 09/27','22 items counted · 11 warnings to review first'],
      ['Finalize the daily count — Wed 09/30','Proteins & avocado · counted at close'],
      ['Finalize the menu mix — Wed 09/30','Sales updated 10/01/2026 05:33 AM'],
      ['Daily count missed — Sun 09/20','The Sep 21 count covered 2 days'],
      ['Daily count missed — Sun 09/06','The Sep 7 count covered 2 days'],
    ],
    recommendation:'Finalize the Sep 27 weekly count first, since it feeds the dashboard tiles and the weekly variance. Then finalize the Sep 30 daily count and menu mix.',
    actions:[
      {title:'Review the 11 warnings, then finalize Sun 09/27', body:'4 high variance, 2 high waste, 2 below PAR, 2 short-shipped and 1 price alert.'},
      {title:'Put the Sunday daily count on the closing checklist', body:'Both missed daily counts in September were Sundays.'},
    ],
  },

  /* ---------------- WEEKLY (Sun 09/27 weekly count, Sep 21 – Sep 27) ---------------- */
  {
    id:100, group:'weekly', badge:'sev-alert', badgeText:'Alert',
    title:'Act. Food Cost % rose to 28.69% — 1.40 pts above ideal, double the usual gap',
    meta:'Week of Sep 21 – Sep 27 · $13,918.01 actual vs $13,240.21 ideal on $48,511.76 sales',
    chips:[{l:'Act. Food Cost %',v:'28.69%',c:''},{l:'Ideal Food Cost %',v:'27.29%',c:''},{l:'Variance $',v:'+$677.80',c:'neg'},{l:'Gap to Ideal',v:'+1.40 pts',c:'neg'}],
    rootCause:'In a normal week the store runs 0.65–0.70 pts above ideal. This week it is 1.40 pts, $677.80 more than the menu mix and recipes say it should have used. Four items make up $544.93 of it. Carne asada, shrimp and avocado are all past their variance limits. Cod is within its 4% limit, but it is the largest food cost line, so 3.1% still comes to $118. The ideal itself also moved up from 26.66% (week of Sep 6) to 27.29%, after vendor price increases on cod, avocado and cheese.',
    tableLabel:'Biggest Variances This Week', tableSub:'Actual vs ideal usage $ by ingredient · Sep 27 weekly count',
    tableHeaders:['Item','Actual $','Ideal $','Over Recipe','Variance $'],
    tableRowIcon:['alert','alert','alert','info','check'],
    tableRowDesc:['Limit 4% · unexplained since Sep 22','Limit 4% · heavy portions since Sep 8','Limit 5% · spoilage since Sep 14','Limit 4% · within limit, high volume','16 ingredients · within their limits'],
    tableRows:[
      ['Carne Asada (Flap Meat)','$2,097.21','$1,918.70','+9.3%','$178.51'],
      ['Shrimp 31/40 P&D','$1,170.53','$1,039.22','+12.6%','$131.31'],
      ['Hass Avocado','$1,180.13','$1,063.43','+11.0%','$116.70'],
      ['Pacific Cod Fillet','$3,926.18','$3,807.77','+3.1%','$118.41'],
      ['All other items','$5,543.96','$5,411.09','+2.5%','$132.87'],
    ],
    recommendation:'Fix the three items over their limits: carne asada, shrimp and avocado. Bringing each one back to its limit saves about $255 a week and puts Act. Food Cost % near 28.2%.',
    actions:[
      {title:'Carne asada back to 4% (−$102/week)', body:'Count at open and close, log staff meals and trim. See the daily Carne Asada insight.'},
      {title:'Shrimp back to 4% (−$90/week)', body:'Portion check and a 2.5 oz scoop at the fry station.'},
      {title:'Avocado back to 5% (−$64/week)', body:'Order for 2 days of sales and ask FreshPoint for firmer fruit.'},
    ],
  },
  {
    id:101, group:'weekly', badge:'sev-alert', badgeText:'Alert',
    title:'US Foods short-shipped all 14 cases of flour tortillas on Sep 25 — the store fell below PAR and borrowed 96 from Carlsbad',
    meta:'Fri 09/25 · US Foods La Mirada DC · 1,344 ordered, 0 received · Sep 27 count 1,128 vs 1,365 min PAR',
    chips:[{l:'Ordered',v:'1,344 ea',c:''},{l:'Received',v:'0 ea',c:'neg'},{l:'Closing vs Min PAR',v:'1,128 / 1,365',c:'neg'},{l:'Transfer In',v:'96 ea ($19.97)',c:''}],
    rootCause:'Every burrito (Fish, Carne Asada, Chicken) and the Kids Quesadilla uses one 12" flour tortilla, 150–220 a day. The Friday order was placed correctly but none of it arrived, so the store ran the busiest days on what it had. On hand fell from 1,461 on Fri to 1,124 at the Sun close and 977 at the Mon close, below the 1,365 min PAR from Saturday. Store 012 - Carlsbad sent 96 on Sat Sep 26. The Tue Sep 29 delivery (1,920) restocked it. It was US Foods\' second short-ship of the week: on Sep 22 it sent 7 of 8 cases of Mexican Crema.',
    tableLabel:'Order Fill This Week', tableSub:'Ordered vs received on supplier deliveries · Sep 21 – Sep 27',
    tableHeaders:['Item','Supplier','Ordered','Received','Fill Rate'],
    tableRowIcon:['alert','alert','info'],
    tableRowDesc:['Closed 1,128 vs 1,365 min PAR','Closed 228.75 lb vs 197.56 lb min PAR','Closed 1,594 vs 1,596 min PAR'],
    tableRows:[
      ['Flour Tortilla 12"','US Foods · Fri 09/25','1,344 ea','0 ea','0%'],
      ['Mexican Crema','US Foods · Tue 09/22','90 lb','78.75 lb','87.5%'],
      ['Limes 175 ct','FreshPoint','1,575 ea','1,575 ea','100%'],
    ],
    recommendation:'Escalate both short-ships with the US Foods rep and ask for an alert before an item fails to ship. Until fill rates recover, order flour tortillas one case above max PAR for Friday, so a missed Friday delivery doesn\'t run into the weekend.',
    actions:[
      {title:'Escalate with US Foods', body:'Two short-ships in one week (crema Sep 22, tortillas Sep 25). Ask for an ETA alert when an item won\'t ship.'},
      {title:'Settle the Carlsbad transfer', body:'96 tortillas ($19.97) came in on Sep 26. Pay it back or return it so both stores\' counts stay right.'},
      {title:'Raise the Friday tortilla order by one case', body:'Weekends use about 210 tortillas a day, so the Friday delivery has to cover three busy days.'},
    ],
  },
  {
    id:102, group:'weekly', badge:'sev-warn', badgeText:'Warning',
    title:'Waste % reached 0.61%, above the 0.55% target — avocado spoilage is 41% of the week\'s waste',
    meta:'Week of Sep 21 – Sep 27 · $296.00 waste on $48,511.76 sales · normal 0.41–0.42%',
    chips:[{l:'Waste $',v:'$296.00',c:''},{l:'Waste %',v:'0.61%',c:'neg'},{l:'Target',v:'0.55%',c:''},{l:'Avocado Share',v:'41%',c:'neg'}],
    rootCause:'Waste held at 0.41–0.42% of sales for six weekly counts until Sep 13. It rose to 0.53% in the week of Sep 14 and 0.61% this week. Nearly all of the increase is avocado: $120.85 this week against about $35 in a normal week. Cod waste is $58.90, which is normal for this store. Spoiled produce and dairy across the store went from $11–14 a day in early September to $19–29 a day.',
    tableLabel:'Waste by Item', tableSub:'Waste $ and share of the week\'s waste · Sep 27 weekly count',
    tableHeaders:['Item','Waste $','Share of Waste'],
    tableRowIcon:['alert','info','info','info','info'],
    tableRowDesc:['Spoiled · normal week ~$35','Normal for this store (~$57/week)','Carne asada, shrimp, mahi, chicken','Cabbage, limes, tomato, cilantro, onion','Dairy, tortillas, sauces, beverage'],
    tableRows:[
      ['Hass Avocado','$120.85','41%'],
      ['Pacific Cod Fillet','$58.90','20%'],
      ['Other proteins','$47.80','16%'],
      ['Other produce','$29.98','10%'],
      ['Everything else','$38.47','13%'],
    ],
    recommendation:'Fixing avocado spoilage alone brings waste back to about 0.43% of sales, inside the 0.55% target.',
    actions:[
      {title:'Avocado ordering (−$86/week)', body:'Order for 2 days of sales and rotate first-in, first-out. See the daily Avocado Waste insight.'},
      {title:'Leave cod as is', body:'Cod waste is $58.90, in line with the $53–61 of a normal week.'},
      {title:'Spot-check cilantro', body:'Cilantro is the other produce item whose waste rose after Sep 14. It is small ($5.03), but it moved at the same time as avocado.'},
    ],
  },
  {
    id:103, group:'weekly', badge:'sev-warn', badgeText:'Warning',
    title:'Three vendor price increases added $1,790 to September costs — Sysco cod +9.1%, FreshPoint avocado +19.6%, Sysco cheese +4.7%',
    meta:'Sep 30 monthly count · Price Change Impact $1,494.78 net (+2.14% weighted) after $591.39 of price drops',
    chips:[{l:'Price Change Impact (Sep)',v:'$1,494.78',c:'neg'},{l:'Weighted Price Change',v:'+2.14%',c:'neg'},{l:'Sysco Cod',v:'+9.1%',c:'neg'},{l:'FreshPoint Avocado',v:'+19.6%',c:'neg'}],
    rootCause:'Sysco raised its cod fillet price 9.1% from Sep 14 ($6.34 → $6.91/lb), and cod is the store\'s largest food cost line. FreshPoint raised its 48-ct avocado 14% on Sep 14 and another 3% on Sep 24 ($1.04 → $1.24). Sysco Monterey Jack jumped 5.4% overnight on Sep 21 ($4.16 → $4.38). Price increases don\'t show up as variance, because the ideal is costed at the same new price, but they raise food cost all the same. Ideal food cost went from 26.66% in the week of Sep 6 to 27.29% this week.',
    tableLabel:'Price Increases in September', tableSub:'Unit cost on Sep 13 vs Sep 30 and the extra $ paid on September deliveries',
    tableHeaders:['Item','Supplier','Sep 13','Sep 30','Change','Sep Impact $'],
    tableRowIcon:['dollar','dollar','dollar','dollar'],
    tableRows:[
      ['Pacific Cod Fillet','Sysco · 4 oz IQF','$6.34/lb','$6.91/lb','+9.1%','$1,031.40'],
      ['Hass Avocado','FreshPoint · 48 ct','$1.04/ea','$1.24/ea','+19.6%','$697.08'],
      ['Mahi Mahi Portion','PFG · 4 oz','$9.52/lb','$9.71/lb','+1.9%','$103.48'],
      ['Monterey Jack Shredded','Sysco · Feather shred','$4.19/lb','$4.39/lb','+4.7%','$61.16'],
    ],
    recommendation:'Push back on the two biggest increases. Move cod volume to PFG (see the next insight), and price avocados against Sysco\'s 60-ct at $1.02 while FreshPoint is at $1.24.',
    actions:[
      {title:'Cod: shift volume to PFG', body:'PFG\'s cod loin is $6.15/lb against Sysco\'s $6.91/lb.'},
      {title:'Avocado: buy more on the Sysco 60-ct', body:'$1.02 against $1.24 at FreshPoint. Sysco supplies 20% of avocados today.'},
      {title:'Cheese: ask Sysco for the reason', body:'Check whether the Sep 21 increase is a market move or the contract price lapsing.'},
    ],
  },
  {
    id:104, group:'weekly', badge:'sev-good', badgeText:'Opportunity',
    title:'Buy more cod from PFG — its loin is $0.76/lb cheaper than Sysco\'s since the Sep 14 increase, worth up to $315 a week',
    meta:'588 lb of cod used in the week of Sep 21 · 70% bought from Sysco · Sysco $6.91/lb vs PFG $6.15/lb',
    chips:[{l:'Sysco Cod Fillet',v:'$6.91/lb',c:''},{l:'PFG Cod Loin',v:'$6.15/lb',c:'pos'},{l:'Price Gap',v:'$0.76/lb',c:''},{l:'Saving if all from PFG',v:'$314.50/week',c:'pos'}],
    rootCause:'Cod is split 70% Sysco, 30% PFG. Before Sep 14 the two prices were close ($6.34 vs $6.21). After Sysco\'s 9.1% increase, PFG is $0.76/lb cheaper. At this week\'s 588 lb, the Sysco share is about 412 lb, and buying all of it from PFG would save about $315 a week. There are trade-offs. PFG delivers only on Wednesdays (Sysco comes Mon · Wed · Fri), cod is counted daily with a 4-day PAR, and the PFG item is a 4–6 oz loin rather than a 4 oz fillet.',
    tableLabel:'Cod Supply Options', tableSub:'The two cod supplier items on file',
    tableHeaders:['Supplier Item','Delivery','Sep 13','Sep 30','Share Now'],
    tableRowIcon:['dollar','check'],
    tableRowDesc:['Sysco San Diego DC · 10 lb cs','PFG Southern California DC · 10 lb cs · min order $400'],
    tableRows:[
      ['Sysco · Cod Fillet Skinless 4 oz IQF','Mon · Wed · Fri','$6.34/lb','$6.91/lb','70%'],
      ['PFG · Pacific Cod Loin 4–6 oz','Wed','$6.21/lb','$6.15/lb','30%'],
    ],
    recommendation:'Flip the split to 70% PFG / 30% Sysco. PFG covers the Wednesday delivery, and Sysco tops up on Mon and Fri. That saves about $180 a week and keeps three deliveries. First check that the loin portions work for the 0.16 lb Baja Fish Taco.',
    actions:[
      {title:'Run a 1-week trial on PFG loin', body:'Cut test portions for the Baja Fish Taco, Fish Burrito and Fish Taco Plate before switching volume.'},
      {title:'Change the supplier-item share', body:'Set PFG to 70% so orders and ideal cost follow the cheaper item.'},
      {title:'Ask Sysco to match', body:'A $0.76/lb gap on about 400 lb a week gives the store room to negotiate.'},
    ],
  },
  {
    id:105, group:'weekly', badge:'sev-warn', badgeText:'Warning',
    title:'The Sep 13 count recorded 9 extra boxes of fountain syrup — it swung variance from −$685 to +$615 across two weeks',
    meta:'Pepsi BIB 5 gal · Sep 13 weekly count 155 gal (31 BIBs) · about 45 gal (9 BIBs) counted twice',
    chips:[{l:'Counted Sep 13',v:'155 gal',c:''},{l:'Over-count',v:'+45 gal (9 BIBs)',c:'neg'},{l:'Week of Sep 7 Variance',v:'−$684.64',c:'neg'},{l:'Week of Sep 14 Variance',v:'+$615.18',c:'neg'}],
    rootCause:'Fountain syrup normally uses about 40 gal a week. The Sep 13 count recorded 155 gal, so that week showed negative usage (−5.5 gal). The next week, measured against the inflated opening, showed 83.25 gal, double the ideal. The two weeks almost cancel out (−$684.64 + $615.18), so no syrup is missing, but both weeks\' numbers were wrong. Act. Food Cost % read 26.17% for the week ending Sep 13 and 29.40% for the week ending Sep 20. Syrup also reads about 5% under ideal every week, so the 0.021 gal-per-drink recipe may be set slightly high.',
    tableLabel:'Fountain Syrup by Weekly Count', tableSub:'Gallons · opening + received − closing = actual usage',
    tableHeaders:['Week Ending','Opening (gal)','Received (gal)','Closing (gal)','Ideal (gal)','Actual (gal)'],
    tableRowIcon:['calendar','calendar','alert','alert','calendar'],
    tableRowDesc:['','','Negative usage warning','High variance warning',''],
    tableRows:[
      ['Sun 08/30','104.5','45','108.5','43.49','41.00'],
      ['Sun 09/06','108.5','0','69.5','40.17','39.00'],
      ['Sun 09/13','69.5','80','155.0','41.71','-5.50'],
      ['Sun 09/20','155.0','0','71.75','40.47','83.25'],
      ['Sun 09/27','71.75','75','109.5','39.00','37.25'],
    ],
    recommendation:'No product is missing, so this is a counting fix. Count BIBs by storage location (back room vs. line) so each box is counted once, and add a note to the Sep 13 and Sep 20 counts so nobody misreads those weeks.',
    actions:[
      {title:'Count beverage by location', body:'Use the count sheet\'s storage locations so the back-room and under-counter BIBs are listed separately.'},
      {title:'Add a negative-usage check before finalize', body:'A negative usage line means the count is wrong. Recount before finalizing.'},
      {title:'Review the syrup recipe', body:'Syrup runs about 5% under ideal every week. Check the 0.021 gal per 22 oz drink against the fountain\'s brix setting.'},
    ],
  },
  {
    id:106, group:'weekly', badge:'sev-good', badgeText:'Opportunity',
    title:'Syrup, cheese and mahi hold 11–21 days of stock — trimming them to a 7-day cover frees about $2,160 of cash',
    meta:'Sep 27 weekly count · inventory $16,468.50 · 8.3 days on hand (target 7 or fewer)',
    chips:[{l:'Inventory $',v:'$16,468.50',c:''},{l:'Days on Hand',v:'8.3 days',c:'neg'},{l:'3 Slow Items On Hand',v:'$4,128.65',c:''},{l:'Cash to Free',v:'$2,161.80',c:'pos'}],
    rootCause:'Most food turns in 4–8 days. Three items sit much longer. Fountain syrup has 20.6 days on hand: 75 gal arrived on Sep 22 against about 40 gal a week of use. Monterey Jack has 16.2 days: it arrives in 20 lb cases once a week and the store uses about 101 lb a week. Mahi has 10.8 days, because PFG delivers once a week. Together they hold $4,128.65. At a 7-day cover they would hold $1,966.85.',
    tableLabel:'Slowest-Moving Items', tableSub:'On-hand value and days on hand at the Sep 27 count',
    tableHeaders:['Item','On Hand $','Days on Hand','Excess over 7 Days'],
    tableRowIcon:['alert','alert','info'],
    tableRowDesc:['Pepsi BIB 5 gal · weekly Tue delivery','Sysco · weekly Thu delivery','PFG · weekly Wed delivery'],
    tableRows:[
      ['Fountain Syrup (BIB)','$1,568.70','20.6','$1,035.20'],
      ['Monterey Jack Shredded','$1,054.24','16.2','$598.70'],
      ['Mahi Mahi Portion','$1,505.71','10.8','$527.90'],
    ],
    recommendation:'Lower the max PAR on syrup and cheese and skip the next syrup delivery. Mahi can stay where it is until PFG adds a second delivery day. Separately, foil sheets (monthly count) still hold 70 days of stock after the Aug 27 over-order.',
    actions:[
      {title:'Skip the next Pepsi syrup delivery', body:'109.5 gal on hand is about 20 days of fountain sales.'},
      {title:'Set cheese max PAR to 7 days', body:'About 101 lb a week, so stop ordering once on hand reaches about 100 lb.'},
      {title:'Leave mahi as is', body:'With one PFG delivery a week, 10–11 days is the minimum safe cover.'},
    ],
  },
];

/* evidence-table row tone per insight: 'bad' = the problem rows (red),
   'warn' = at-risk (amber), 'good' = the fix / cheaper option (green),
   'ok' = within limit (blue) */
const SI_INS_ROW_TONES = {
  0:['warn','warn','bad','warn','warn','warn','bad'],
  1:['bad','warn','warn','warn','warn','warn','bad','warn','warn'],
  2:['ok','warn','bad','warn','warn','bad'],
  100:['bad','bad','bad','ok','ok'],
  101:['bad','warn','ok'],
  102:['bad','ok','ok','ok','ok'],
  103:['bad','bad','ok','warn'],
  104:['bad','good'],
  105:['ok','ok','bad','bad','ok'],
  106:['bad','bad','warn'],
};
SI_INS_ALL.forEach(i => { if (SI_INS_ROW_TONES[i.id]) i.tableRowTone = SI_INS_ROW_TONES[i.id]; });

/* Root Cause as short scannable bullets */
const SI_INS_ROOT_POINTS = {
  0:[
    'Recipe: <b>0.16 lb</b> shrimp per Crispy Shrimp Taco',
    'Until Sep 7: <b>1–6%</b> over, inside the 4% limit',
    'Since Sep 8: <b>6–19%</b> over on every daily count',
    'Waste logged is only <b>0.1–0.3 lb</b> a day, so portions are heavy',
  ],
  1:[
    'Sep 22 – Sep 30: <b>9 counts</b> in a row over the 4% limit',
    '<b>33.19 lb</b> more than sales explain, only <b>2.80 lb</b> logged as waste',
    'The Sysco price <b>went down</b>, so it isn\'t a price effect',
    'A sudden, steady gap usually means <b>product leaving untracked</b>',
  ],
  2:[
    'Waste went from <b>~4 a day</b> (early Sep) to <b>12–18 a day</b>',
    'All logged as <b>Spoiled</b>, so fruit goes bad before use',
    'FreshPoint price is up <b>19.6%</b> since Sep 13 ($1.04 → $1.24)',
    'Min PAR of <b>552</b> covers about 4 days, so ripe fruit waits',
  ],
  3:[
    'The Sep 27 <b>weekly count</b> isn\'t finalized, so weekly numbers are provisional',
    'The Sep 30 <b>daily count</b> and <b>menu mix</b> are also open',
    'Daily counts were <b>missed on Sun Sep 20 and Sun Sep 6</b>',
  ],
  100:[
    'Gap to ideal is <b>1.40 pts</b>, against <b>0.65–0.70</b> in a normal week',
    '<b>Carne asada, shrimp and avocado</b> are over their limits ($426.52)',
    'Cod is within its limit but is the <b>largest line</b> ($118.41)',
    'The ideal itself rose <b>26.66% → 27.29%</b> after price increases',
  ],
  101:[
    '<b>0 of 1,344</b> flour tortillas arrived on Fri Sep 25',
    'On hand fell to <b>977</b> by the Mon close, against a <b>1,365</b> min PAR',
    '<b>96</b> borrowed from 012 - Carlsbad on Sep 26',
    'US Foods\' <b>2nd short-ship</b> this week (crema, Sep 22)',
  ],
  102:[
    'Waste was <b>0.41–0.42%</b> for six weekly counts, now <b>0.61%</b>',
    'Avocado: <b>$120.85</b> this week vs about <b>$35</b> normally',
    'Cod waste is <b>normal</b> ($58.90)',
  ],
  103:[
    'Sysco cod <b>+9.1%</b> from Sep 14, the largest food cost line',
    'FreshPoint avocado <b>+19.6%</b> (Sep 14 and Sep 24)',
    'Sysco cheese <b>+4.7%</b> since Sep 13 (a 5.4% jump on Sep 21)',
    'Ideal food cost rose <b>26.66% → 27.29%</b>',
  ],
  104:[
    'Cod split today: <b>70% Sysco / 30% PFG</b>',
    'After Sep 14, PFG is <b>$0.76/lb</b> cheaper',
    'The Sysco share of 588 lb is about <b>412 lb</b> a week, worth <b>$315</b>',
    'Trade-off: PFG delivers <b>Wednesday only</b>',
  ],
  105:[
    'Sep 13 counted <b>155 gal</b> against about 110 on the shelf',
    'Week of Sep 7: <b>−5.5 gal</b> usage (negative)',
    'Week of Sep 14: <b>83.25 gal</b>, double the ideal',
    'The two weeks net out, so <b>nothing is missing</b>',
  ],
  106:[
    'Store average is <b>8.3 days</b> on hand, against a target of 7',
    'Syrup <b>20.6 days</b>, cheese <b>16.2</b>, mahi <b>10.8</b>',
    'At a 7-day cover these three free about <b>$2,160</b>',
  ],
};
SI_INS_ALL.forEach(i => { if (SI_INS_ROOT_POINTS[i.id]) i.rootPoints = SI_INS_ROOT_POINTS[i.id]; });

/* 2–3 word name per insight (left list + detail heading) */
const SI_INS_SHORT = {
  0:'Shrimp Over-Portioning', 1:'Carne Asada Shrink', 2:'Avocado Spoilage', 3:'Counts Not Finalized',
  100:'Food Cost Above Ideal', 101:'Tortilla Short-Ship', 102:'Waste Over Target',
  103:'Vendor Price Increases', 104:'Cheaper Cod Supplier', 105:'Syrup Miscount', 106:'Slow-Moving Stock',
};
SI_INS_ALL.forEach(i => { i.short = SI_INS_SHORT[i.id] || i.title.split(' — ')[0]; });

/* icon in the left-list circle (icon set in insights-render.js) */
const SI_INS_LIST_ICON = {
  0:'scale', 1:'alert', 2:'trash', 3:'doc',
  100:'trend', 101:'truck', 102:'trash', 103:'tag', 104:'dollar', 105:'box', 106:'box',
};

/* when the insight was generated — inventory insights run after the
   overnight sales post (10/01/2026 05:33 AM) */
const SI_INS_DETECTED = {
  0:{ time:'6:05 AM' }, 1:{ time:'6:10 AM' }, 2:{ time:'6:15 AM' }, 3:{ time:'6:20 AM' },
  100:{ time:'Mon 6:00 AM' }, 101:{ time:'Mon 6:05 AM' }, 102:{ time:'Mon 6:10 AM' }, 103:{ time:'Mon 6:15 AM' },
  104:{ time:'Mon 6:20 AM' }, 105:{ time:'Mon 6:25 AM' }, 106:{ time:'Mon 6:30 AM' },
};

if (typeof window !== 'undefined') {
  window.SI_INS_ALL = SI_INS_ALL;
  window.SI_INS_LIST_ICON = SI_INS_LIST_ICON;
  window.SI_INS_DETECTED = SI_INS_DETECTED;
}

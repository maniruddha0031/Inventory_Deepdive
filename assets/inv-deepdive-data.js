/* ============================================================
   Inventory Insight — Deep Dive data model (store 007 - Encinitas)
   Modelled on HubWorks Zip Inventory (HW Release/hubworks):
     - inventory count  EOInvMain       (one count on a business date for one
                                         count frequency; opening = the previous
                                         count of the same frequency)
     - count frequency  EOCustCntFreq   (Daily / Weekly / Monthly)
     - category         EOCustIngrCatgry (major + minor category)
     - ingredient       EOCustIngrPrep  (reporting unit, variance limit,
                                         isCopyActToTheo, storage location)
     - supplier item    EOCustVit / EOSiteVit (case pack, unit cost, PAR)
     - supplier / DC    EOCustVendor / EOCustVenDC (+ EODvlCal delivery days)
     - menu + recipe    EOCustMenuItem / EOCustRecipe (ideal usage)
     - events           EODvlInvoice (deliveries), EOTrfMain (transfers),
                        EOWstMain (waste), EOFshMain (menu mix / sales)
   The store is simulated DAY BY DAY (Jul 1 – Sep 30, 2026): sales and menu
   mix, true usage, waste, deliveries on each DC's delivery days, transfers.
   Counts are taken on their count dates (Daily / Weekly on Sundays /
   Monthly on month end). Leaf record = one supplier item x one inventory
   count — the EOInvVitDetail roll-up. Every KPI is AGGREGATED from those
   leaves (invAggregate); nothing is typed per row.
   Formulas follow EOInvMain / EOInvFinDetail:
     Actual usage = Opening + Deliveries + Transfer In - Transfer Out - Closing
     Variance     = Actual - Ideal (ACTMINTHEO, the default)
     Actual %     = Actual usage $ / Sales $
     Days on hand = Inventory value / (Actual usage $ / days in the count period)
   ============================================================ */

const INV_DAY0 = new Date(2026, 5, 30);            // day 0 = Jun 30, 2026 (opening count)
const INV_DAYS = 92;                               // day 1..92 = Jul 1 .. Sep 30, 2026
const INV_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INV_STORE = '007 - Encinitas';

/* ---- inventory types (category major) and categories (minor) ---- */
const INV_TYPES = ['Food', 'Beverage', 'Paper & Packaging', 'Chemicals'];
const INV_CATEGORIES = [
  { id:'seafood',  name:'Seafood',             type:'Food',              gl:'5010' },
  { id:'meat',     name:'Meat & Poultry',      type:'Food',              gl:'5020' },
  { id:'produce',  name:'Produce',             type:'Food',              gl:'5030' },
  { id:'dairy',    name:'Dairy & Cheese',      type:'Food',              gl:'5040' },
  { id:'tortilla', name:'Tortillas & Chips',   type:'Food',              gl:'5050' },
  { id:'dry',      name:'Dry Goods & Oils',    type:'Food',              gl:'5060' },
  { id:'sauce',    name:'Sauces & Condiments', type:'Food',              gl:'5070' },
  { id:'bev',      name:'Beverage',            type:'Beverage',          gl:'5110' },
  { id:'paper',    name:'Paper & Packaging',   type:'Paper & Packaging', gl:'5210' },
  { id:'chem',     name:'Cleaning & Chemicals',type:'Chemicals',         gl:'5310' },
];

/* ---- count frequencies (EOGlbCntFreq seed: Daily, Weekly, Monthly) ---- */
const INV_FREQS = [
  { id:'Daily',   label:'Daily count',   perWeek:7, sub:'High-value proteins & avocados, counted every close' },
  { id:'Weekly',  label:'Weekly count',  perWeek:1, sub:'Produce, dairy, tortillas, sauces, beverage — Sunday close' },
  { id:'Monthly', label:'Monthly count', perWeek:0, sub:'Dry goods, paper & chemicals — period-end count' },
];

/* ---- storage locations (EOCustStrLoc) ---- */
const INV_STORAGE = ['Walk-In Freezer', 'Walk-In Cooler', 'Dry Storage', 'Line Storage', 'Chemical Shelf'];

/* ---- suppliers (EOCustVendor, vendorType 1 = Distributor) and their
   distribution centers (EOCustVenDC) with the delivery calendar ---- */
const INV_SUPPLIERS = [
  { id:'sysco', name:'Sysco',              type:'Distributor', tone:'#1d4ed8', bg:'#dbeafe', electronic:true },
  { id:'usf',   name:'US Foods',           type:'Distributor', tone:'#047857', bg:'#d1fae5', electronic:true },
  { id:'pfg',   name:'Performance Foodservice (PFG)', short:'PFG', type:'Distributor', tone:'#b45309', bg:'#fef3c7', electronic:true },
  { id:'fresh', name:'FreshPoint',         type:'Distributor', tone:'#15803d', bg:'#dcfce7', electronic:true },
  { id:'pepsi', name:'Pepsi Beverages',    short:'Pepsi', type:'Distributor', tone:'#1e40af', bg:'#e0e7ff', electronic:false },
];
const INV_DCS = [
  { id:'sysco-sd', supplier:'sysco', name:'Sysco San Diego DC',     days:'Mon · Wed · Fri', perWeek:3, cutoff:'2:00 PM day prior', minOrder:'$750' },
  { id:'sysco-la', supplier:'sysco', name:'Sysco Los Angeles DC',   days:'Thu',             perWeek:1, cutoff:'11:00 AM Tue',      minOrder:'$500' },
  { id:'usf-lm',   supplier:'usf',   name:'US Foods La Mirada DC',  days:'Tue · Fri',       perWeek:2, cutoff:'3:00 PM day prior', minOrder:'$600' },
  { id:'pfg-sc',   supplier:'pfg',   name:'PFG Southern California DC', days:'Wed',         perWeek:1, cutoff:'12:00 PM Mon',      minOrder:'$400' },
  { id:'fresh-sd', supplier:'fresh', name:'FreshPoint San Diego DC', days:'Mon · Wed · Sat', perWeek:3, cutoff:'4:00 PM day prior', minOrder:'$250' },
  { id:'pepsi-cb', supplier:'pepsi', name:'Pepsi Carlsbad DC',      days:'Tue',             perWeek:1, cutoff:'Rep order Mon',     minOrder:'—' },
];

/* ---- ingredients (EOCustIngrPrep) with their supplier items (EOCustVit).
   unit = reporting unit; cost = $ per reporting unit; pack = reporting
   units per case; share = share of the ingredient bought on that item;
   varLimit = variance limit % of ideal; copyAct = "Copy actual to ideal"
   (non-recipe supplies); parDays = PAR expressed in days of usage;
   waste = normal waste rate. ---- */
const INV_INGREDIENTS = [
  // Seafood — daily count, walk-in freezer
  { id:'cod', name:'Pacific Cod Fillet', cat:'seafood', unit:'lb', cost:6.40, freq:'Daily', loc:'Walk-In Freezer', varLimit:4, parDays:4, waste:0.015,
    items:[ { id:'v-cod-sy', sup:'sysco', dc:'sysco-sd', name:'Cod Fillet Skinless 4 oz IQF', sku:'4471023', pack:10, packLbl:'10 lb cs', share:0.7, mult:1.00 },
            { id:'v-cod-pf', sup:'pfg', dc:'pfg-sc', name:'Pacific Cod Loin 4–6 oz', sku:'PF-208841', pack:10, packLbl:'10 lb cs', share:0.3, mult:0.96 } ] },
  { id:'shrimp', name:'Shrimp 31/40 P&D', cat:'seafood', unit:'lb', cost:8.90, freq:'Daily', loc:'Walk-In Freezer', varLimit:4, parDays:4, waste:0.012,
    items:[ { id:'v-shr-us', sup:'usf', dc:'usf-lm', name:'Shrimp White 31/40 P&D Tail-Off', sku:'US-7712904', pack:10, packLbl:'2 × 5 lb cs', share:1, mult:1 } ] },
  { id:'mahi', name:'Mahi Mahi Portion 4 oz', cat:'seafood', unit:'lb', cost:9.60, freq:'Daily', loc:'Walk-In Freezer', varLimit:4, parDays:5, waste:0.012,
    items:[ { id:'v-mahi-pf', sup:'pfg', dc:'pfg-sc', name:'Mahi Mahi Portion 4 oz Skinless', sku:'PF-331052', pack:10, packLbl:'10 lb cs', share:1, mult:1 } ] },
  // Meat — daily count, walk-in cooler
  { id:'steak', name:'Carne Asada (Flap Meat)', cat:'meat', unit:'lb', cost:7.20, freq:'Daily', loc:'Walk-In Cooler', varLimit:4, parDays:3, waste:0.01,
    items:[ { id:'v-steak-sy', sup:'sysco', dc:'sysco-sd', name:'Beef Flap Meat Marinated Asada', sku:'5530117', pack:20, packLbl:'4 × 5 lb cs', share:1, mult:1 } ] },
  { id:'chicken', name:'Chicken Thigh Boneless', cat:'meat', unit:'lb', cost:3.10, freq:'Daily', loc:'Walk-In Cooler', varLimit:4, parDays:3, waste:0.012,
    items:[ { id:'v-chk-sy', sup:'sysco', dc:'sysco-sd', name:'Chicken Thigh Bnls Sknls Fresh', sku:'2210984', pack:40, packLbl:'4 × 10 lb cs', share:1, mult:1 } ] },
  { id:'avocado', name:'Hass Avocado', cat:'produce', unit:'ea', cost:1.05, freq:'Daily', loc:'Walk-In Cooler', varLimit:5, parDays:4, waste:0.035,
    items:[ { id:'v-avo-fp', sup:'fresh', dc:'fresh-sd', name:'Avocado Hass 48 ct', sku:'FP-10448', pack:48, packLbl:'48 ct cs', share:0.8, mult:1.00 },
            { id:'v-avo-sy', sup:'sysco', dc:'sysco-sd', name:'Avocado Hass 60 ct', sku:'1880463', pack:60, packLbl:'60 ct cs', share:0.2, mult:0.97 } ] },
  // Produce — weekly count
  { id:'cabbage', name:'Green Cabbage Shredded', cat:'produce', unit:'lb', cost:1.10, freq:'Weekly', loc:'Walk-In Cooler', varLimit:6, parDays:6, waste:0.04,
    items:[ { id:'v-cab-fp', sup:'fresh', dc:'fresh-sd', name:'Cabbage Green Shredded 1/8"', sku:'FP-20115', pack:20, packLbl:'4 × 5 lb cs', share:1, mult:1 } ] },
  { id:'lime', name:'Limes 175 ct', cat:'produce', unit:'ea', cost:0.14, freq:'Weekly', loc:'Walk-In Cooler', varLimit:8, parDays:7, waste:0.03,
    items:[ { id:'v-lime-fp', sup:'fresh', dc:'fresh-sd', name:'Lime Persian 175 ct', sku:'FP-30175', pack:175, packLbl:'175 ct cs', share:1, mult:1 } ] },
  { id:'cilantro', name:'Cilantro', cat:'produce', unit:'bunch', cost:0.55, freq:'Weekly', loc:'Walk-In Cooler', varLimit:8, parDays:5, waste:0.06,
    items:[ { id:'v-cil-fp', sup:'fresh', dc:'fresh-sd', name:'Cilantro Iceless 30 bunch', sku:'FP-40230', pack:30, packLbl:'30 bn cs', share:1, mult:1 } ] },
  { id:'tomato', name:'Roma Tomato', cat:'produce', unit:'lb', cost:1.35, freq:'Weekly', loc:'Walk-In Cooler', varLimit:6, parDays:6, waste:0.04,
    items:[ { id:'v-tom-fp', sup:'fresh', dc:'fresh-sd', name:'Tomato Roma 2-Layer', sku:'FP-50125', pack:25, packLbl:'25 lb cs', share:1, mult:1 } ] },
  { id:'onion', name:'White Onion', cat:'produce', unit:'lb', cost:0.72, freq:'Weekly', loc:'Dry Storage', varLimit:6, parDays:8, waste:0.02,
    items:[ { id:'v-oni-fp', sup:'fresh', dc:'fresh-sd', name:'Onion White Jumbo', sku:'FP-60150', pack:50, packLbl:'50 lb sack', share:1, mult:1 } ] },
  // Dairy — weekly
  { id:'cheese', name:'Monterey Jack Shredded', cat:'dairy', unit:'lb', cost:4.20, freq:'Weekly', loc:'Walk-In Cooler', varLimit:5, parDays:7, waste:0.01,
    items:[ { id:'v-chz-sy', sup:'sysco', dc:'sysco-la', name:'Cheese Monterey Jack Fthr Shred', sku:'3304411', pack:20, packLbl:'4 × 5 lb cs', share:1, mult:1 } ] },
  { id:'crema', name:'Mexican Crema', cat:'dairy', unit:'lb', cost:3.40, freq:'Weekly', loc:'Walk-In Cooler', varLimit:5, parDays:7, waste:0.015,
    items:[ { id:'v-crm-us', sup:'usf', dc:'usf-lm', name:'Crema Mexicana 15 oz', sku:'US-4401187', pack:11.25, packLbl:'12 × 15 oz cs', share:1, mult:1 } ] },
  // Tortillas & chips — weekly, line storage
  { id:'corntort', name:'Corn Tortilla 6"', cat:'tortilla', unit:'ea', cost:0.045, freq:'Weekly', loc:'Line Storage', varLimit:5, parDays:6, waste:0.02,
    items:[ { id:'v-ct-us', sup:'usf', dc:'usf-lm', name:'Tortilla Corn White 6" Yellow Band', sku:'US-1109560', pack:1080, packLbl:'12 × 90 ct cs', share:1, mult:1 } ] },
  { id:'flourtort', name:'Flour Tortilla 12"', cat:'tortilla', unit:'ea', cost:0.21, freq:'Weekly', loc:'Line Storage', varLimit:5, parDays:7, waste:0.01,
    items:[ { id:'v-ft-us', sup:'usf', dc:'usf-lm', name:'Tortilla Flour 12" Pressed', sku:'US-1109812', pack:96, packLbl:'8 × 12 ct cs', share:1, mult:1 } ] },
  { id:'chips', name:'Tortilla Chips', cat:'tortilla', unit:'lb', cost:1.70, freq:'Weekly', loc:'Dry Storage', varLimit:6, parDays:7, waste:0.02,
    items:[ { id:'v-chip-us', sup:'usf', dc:'usf-lm', name:'Chip Tortilla Tri-Cut Yellow', sku:'US-2250031', pack:30, packLbl:'30 lb cs', share:1, mult:1 } ] },
  // Sauces — weekly
  { id:'salsa', name:'Salsa Verde', cat:'sauce', unit:'lb', cost:2.30, freq:'Weekly', loc:'Walk-In Cooler', varLimit:6, parDays:8, waste:0.015,
    items:[ { id:'v-sal-sy', sup:'sysco', dc:'sysco-sd', name:'Salsa Verde Tomatillo Refrig', sku:'6612290', pack:16, packLbl:'4 × 4 lb cs', share:1, mult:1 } ] },
  { id:'mayo', name:'Mayonnaise (White Sauce)', cat:'sauce', unit:'lb', cost:2.05, freq:'Weekly', loc:'Dry Storage', varLimit:6, parDays:10, waste:0.005,
    items:[ { id:'v-mayo-sy', sup:'sysco', dc:'sysco-sd', name:'Mayonnaise Extra Heavy 1 gal', sku:'5011432', pack:30, packLbl:'4 × 1 gal cs', share:1, mult:1 } ] },
  // Dry goods — monthly
  { id:'batter', name:'Tempura Batter Mix', cat:'dry', unit:'lb', cost:1.90, freq:'Monthly', loc:'Dry Storage', varLimit:6, parDays:20, waste:0.005,
    items:[ { id:'v-bat-sy', sup:'sysco', dc:'sysco-sd', name:'Batter Mix Tempura', sku:'4128830', pack:25, packLbl:'25 lb bag', share:1, mult:1 } ] },
  { id:'oil', name:'Fryer Oil Canola', cat:'dry', unit:'lb', cost:1.45, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:16, waste:0.0,
    items:[ { id:'v-oil-sy', sup:'sysco', dc:'sysco-sd', name:'Oil Canola Clear Fry 35 lb', sku:'4089921', pack:35, packLbl:'35 lb jug', share:1, mult:1 } ] },
  { id:'rice', name:'Long Grain Rice', cat:'dry', unit:'lb', cost:0.62, freq:'Monthly', loc:'Dry Storage', varLimit:6, parDays:20, waste:0.005,
    items:[ { id:'v-rice-sy', sup:'sysco', dc:'sysco-la', name:'Rice Long Grain Parboiled', sku:'4521190', pack:50, packLbl:'50 lb bag', share:1, mult:1 } ] },
  { id:'beans', name:'Refried Beans #10', cat:'dry', unit:'can', cost:6.10, freq:'Monthly', loc:'Dry Storage', varLimit:6, parDays:20, waste:0.005,
    items:[ { id:'v-bean-sy', sup:'sysco', dc:'sysco-la', name:'Beans Refried Traditional #10', sku:'4610228', pack:6, packLbl:'6 × #10 cs', share:1, mult:1 } ] },
  // Beverage — weekly
  { id:'syrup', name:'Pepsi Fountain Syrup', cat:'bev', unit:'gal', cost:14.50, freq:'Weekly', loc:'Dry Storage', varLimit:6, parDays:10, waste:0.0,
    items:[ { id:'v-syr-pe', sup:'pepsi', dc:'pepsi-cb', name:'Pepsi BIB 5 gal', sku:'PB-50012', pack:5, packLbl:'5 gal BIB', share:1, mult:1 } ] },
  { id:'horchata', name:'Horchata Concentrate', cat:'bev', unit:'gal', cost:11.20, freq:'Weekly', loc:'Walk-In Cooler', varLimit:6, parDays:10, waste:0.01,
    items:[ { id:'v-hor-sy', sup:'sysco', dc:'sysco-sd', name:'Horchata Concentrate 1 gal', sku:'7120045', pack:4, packLbl:'4 × 1 gal cs', share:1, mult:1 } ] },
  // Paper & packaging — monthly
  { id:'foil', name:'Foil Wrap Sheets 12×14', cat:'paper', unit:'ea', cost:0.035, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:24, waste:0.01,
    items:[ { id:'v-foil-sy', sup:'sysco', dc:'sysco-la', name:'Foil Sheet Interfolded 12×14', sku:'8820144', pack:3000, packLbl:'6 × 500 cs', share:1, mult:1 } ] },
  { id:'boat', name:'Taco Boat Paper #50', cat:'paper', unit:'ea', cost:0.028, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:24, waste:0.01,
    items:[ { id:'v-boat-us', sup:'usf', dc:'usf-lm', name:'Food Tray Paper #50 Red Check', sku:'US-6600050', pack:5000, packLbl:'5000 ct cs', share:1, mult:1 } ] },
  { id:'cup', name:'Cup 22 oz Plastic', cat:'paper', unit:'ea', cost:0.085, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:24, waste:0.01,
    items:[ { id:'v-cup-sy', sup:'sysco', dc:'sysco-la', name:'Cup Plastic Cold 22 oz', sku:'8811220', pack:2000, packLbl:'2000 ct cs', share:1, mult:1 } ] },
  { id:'lid', name:'Lid 22 oz Sip-Thru', cat:'paper', unit:'ea', cost:0.030, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:24, waste:0.01,
    items:[ { id:'v-lid-sy', sup:'sysco', dc:'sysco-la', name:'Lid Sip-Thru 22 oz', sku:'8811221', pack:2000, packLbl:'2000 ct cs', share:1, mult:1 } ] },
  { id:'clam', name:'Clamshell Plate 9"', cat:'paper', unit:'ea', cost:0.19, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:24, waste:0.01,
    items:[ { id:'v-clam-us', sup:'usf', dc:'usf-lm', name:'Container Hinged Fiber 9" 3-Comp', sku:'US-6612090', pack:200, packLbl:'200 ct cs', share:1, mult:1 } ] },
  { id:'bag', name:'To-Go Bag Kraft', cat:'paper', unit:'ea', cost:0.11, freq:'Monthly', loc:'Dry Storage', varLimit:8, parDays:24, waste:0.0,
    items:[ { id:'v-bag-us', sup:'usf', dc:'usf-lm', name:'Bag Kraft Handled #8', sku:'US-6630008', pack:500, packLbl:'500 ct cs', share:1, mult:1 } ] },
  { id:'napkin', name:'Napkins Dispenser', cat:'paper', unit:'ea', cost:0.009, freq:'Monthly', loc:'Dry Storage', varLimit:10, parDays:24, waste:0.0, copyAct:true, perK:260,
    items:[ { id:'v-nap-sy', sup:'sysco', dc:'sysco-la', name:'Napkin Dispenser Interfold', sku:'8840610', pack:6000, packLbl:'6000 ct cs', share:1, mult:1 } ] },
  // Chemicals — monthly, not in any recipe: "Copy actual to ideal"
  { id:'sanitizer', name:'Quat Sanitizer', cat:'chem', unit:'gal', cost:9.80, freq:'Monthly', loc:'Chemical Shelf', varLimit:10, parDays:24, waste:0, copyAct:true, perK:0.16,
    items:[ { id:'v-san-sy', sup:'sysco', dc:'sysco-la', name:'Sanitizer Quat Multi-Surface', sku:'9910044', pack:4, packLbl:'4 × 1 gal cs', share:1, mult:1 } ] },
  { id:'degreaser', name:'Kitchen Degreaser', cat:'chem', unit:'gal', cost:12.40, freq:'Monthly', loc:'Chemical Shelf', varLimit:10, parDays:24, waste:0, copyAct:true, perK:0.07,
    items:[ { id:'v-deg-sy', sup:'sysco', dc:'sysco-la', name:'Degreaser Heavy Duty Conc.', sku:'9910210', pack:4, packLbl:'4 × 1 gal cs', share:1, mult:1 } ] },
  { id:'gloves', name:'Nitrile Gloves (L)', cat:'chem', unit:'box', cost:8.50, freq:'Monthly', loc:'Chemical Shelf', varLimit:10, parDays:24, waste:0, copyAct:true, perK:0.34,
    items:[ { id:'v-glv-sy', sup:'sysco', dc:'sysco-la', name:'Glove Nitrile Blue PF Large', sku:'9920118', pack:10, packLbl:'10 × 100 ct cs', share:1, mult:1 } ] },
];

/* ---- menu items + recipes (EOCustMenuItem / EOCustRecipe). Recipe qty is
   in each ingredient's reporting unit per menu item sold. base = weekly
   units sold before the week factor. ---- */
const INV_MENU = [
  { id:'m-baja',   name:'Baja Fish Taco',        group:'Tacos',    price:4.49,  base:2300,
    recipe:{ cod:0.16, batter:0.03, oil:0.05, corntort:2, cabbage:0.06, crema:0.04, mayo:0.02, lime:0.25, salsa:0.02, boat:1 } },
  { id:'m-grill',  name:'Grilled Mahi Taco',     group:'Tacos',    price:4.99,  base:620,
    recipe:{ mahi:0.17, corntort:2, cabbage:0.05, crema:0.03, avocado:0.15, lime:0.25, boat:1 } },
  { id:'m-shrimp', name:'Crispy Shrimp Taco',    group:'Tacos',    price:4.99,  base:800,
    recipe:{ shrimp:0.16, batter:0.02, oil:0.03, corntort:2, cabbage:0.05, crema:0.04, lime:0.25, boat:1 } },
  { id:'m-asada',  name:'Carne Asada Taco',      group:'Tacos',    price:4.29,  base:880,
    recipe:{ steak:0.17, corntort:2, onion:0.03, cilantro:0.04, salsa:0.03, lime:0.25, boat:1 } },
  { id:'m-chk',    name:'Chicken Taco',          group:'Tacos',    price:3.79,  base:570,
    recipe:{ chicken:0.17, corntort:2, cheese:0.03, tomato:0.04, onion:0.02, salsa:0.02, boat:1 } },
  { id:'m-fishb',  name:'Fish Burrito',          group:'Burritos', price:10.99, base:460,
    recipe:{ cod:0.30, batter:0.05, oil:0.08, flourtort:1, rice:0.10, beans:0.06, cabbage:0.08, crema:0.06, mayo:0.03, cheese:0.05, foil:1, bag:0.3 } },
  { id:'m-asadab', name:'Carne Asada Burrito',   group:'Burritos', price:11.49, base:420,
    recipe:{ steak:0.32, flourtort:1, rice:0.10, beans:0.06, cheese:0.06, tomato:0.06, onion:0.04, cilantro:0.05, avocado:0.5, foil:1, bag:0.3 } },
  { id:'m-chkb',   name:'Chicken Burrito',       group:'Burritos', price:9.99,  base:330,
    recipe:{ chicken:0.30, flourtort:1, rice:0.12, beans:0.08, cheese:0.07, tomato:0.06, salsa:0.04, foil:1, bag:0.3 } },
  { id:'m-plate',  name:'Fish Taco Plate',       group:'Plates',   price:12.99, base:370,
    recipe:{ cod:0.32, batter:0.06, oil:0.10, corntort:4, cabbage:0.10, crema:0.08, rice:0.10, beans:0.08, lime:0.5, clam:1, bag:0.4 } },
  { id:'m-guac',   name:'Chips & Guacamole',     group:'Sides',    price:5.49,  base:560,
    recipe:{ chips:0.30, avocado:1.2, tomato:0.08, onion:0.04, cilantro:0.10, lime:0.5, boat:1 } },
  { id:'m-quesa',  name:'Kids Quesadilla',       group:'Kids',     price:5.99,  base:160,
    recipe:{ flourtort:1, cheese:0.12, chips:0.08, boat:1 } },
  { id:'m-soda',   name:'Fountain Drink 22 oz',  group:'Beverage', price:2.79,  base:2020,
    recipe:{ syrup:0.021, cup:1, lid:1 } },
  { id:'m-horch',  name:'Horchata 22 oz',        group:'Beverage', price:3.49,  base:460,
    recipe:{ horchata:0.035, cup:1, lid:1 } },
];


/* ---- seeded RNG (mulberry32) so the demo is stable across reloads ---- */
function invRng(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const invRand = invRng(20260930);
const invNoise = a => (invRand() * 2 - 1) * a;      // uniform in [-a, a]
const inv2 = v => Math.round(v * 100) / 100;
/* stable per-key noise (same item + day -> same count, whatever the frequency) */
function invHashNoise(key, a){
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (invRng(h)() * 2 - 1) * a;
}

/* ---- lookups ---- */
const INV_ING_BY_ID = {}; INV_INGREDIENTS.forEach(i => { INV_ING_BY_ID[i.id] = i; });
const INV_CAT_BY_ID = {}; INV_CATEGORIES.forEach(c => { INV_CAT_BY_ID[c.id] = c; });
const INV_SUP_BY_ID = {}; INV_SUPPLIERS.forEach(s => { INV_SUP_BY_ID[s.id] = s; });
const INV_DC_BY_ID = {};  INV_DCS.forEach(d => { INV_DC_BY_ID[d.id] = d; });
const INV_MENU_BY_ID = {}; INV_MENU.forEach(m => { INV_MENU_BY_ID[m.id] = m; });
const INV_ITEMS = [];
INV_INGREDIENTS.forEach(ing => ing.items.forEach(it => INV_ITEMS.push(Object.assign({ ingredient: ing.id }, it))));
const INV_ITEM_BY_ID = {}; INV_ITEMS.forEach(i => { INV_ITEM_BY_ID[i.id] = i; });
const INV_WHERE_USED = {};
INV_MENU.forEach(m => Object.keys(m.recipe).forEach(ing => { (INV_WHERE_USED[ing] = INV_WHERE_USED[ing] || []).push(m.id); }));

/* ---- calendar ---- */
function invDate(d){ const x = new Date(INV_DAY0.getTime()); x.setDate(x.getDate() + d); return x; }
function invMDY(d){ const x = invDate(d); return String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0') + '/' + x.getFullYear(); }
function invMonDay(d){ const x = invDate(d); return INV_MONTHS[x.getMonth()] + ' ' + x.getDate(); }
const invDow = d => invDate(d).getDay();             // 0 = Sun

/* ---- daily sales + menu mix (EOFshMain / EOFshDetail) ---- */
const INV_DOW_FACTOR = [1.15, 0.78, 0.82, 0.90, 0.98, 1.20, 1.17];    // Sun..Sat (sums to 7)
function invSeason(d){
  const m = invDate(d).getMonth();
  let f = m === 6 ? 1.00 : m === 7 ? 1.03 : 0.95;
  if (d === 69) f *= 1.35;                         // Labor Day, Sep 7
  if (d >= 85) f *= 0.97;                          // post-season slowdown
  return f;
}
const INV_MENU_DAILY = [];                          // { day, menuId, units, sales, theoCost }
const INV_DAY_SALES = new Array(INV_DAYS + 1).fill(0);
for (let d = 1; d <= INV_DAYS; d++) {
  INV_MENU.forEach(m => {
    const units = Math.max(0, Math.round(m.base / 7 * INV_DOW_FACTOR[invDow(d)] * invSeason(d) * (1 + invNoise(0.06))));
    const sales = inv2(units * m.price);
    INV_MENU_DAILY.push({ day:d, menuId:m.id, units, sales, theoCost:0 });
    INV_DAY_SALES[d] += sales;
  });
  INV_DAY_SALES[d] = inv2(INV_DAY_SALES[d]);
}

/* ---- supplier item unit cost per day (price trend + price stories) ---- */
const INV_ITEM_COST = {};
INV_ITEMS.forEach(it => {
  const ing = INV_ING_BY_ID[it.ingredient], phase = invRand() * 6, arr = [];
  for (let d = 0; d <= INV_DAYS; d++) {
    let c = ing.cost * it.mult * (1 + Math.sin(phase + d / 9) * 0.012);
    if (it.id === 'v-cod-sy' && d >= 76) c *= 1.07;      // Sysco cod +7% from Sep 14
    if (it.id === 'v-avo-fp' && d >= 76) c *= 1.14;      // FreshPoint avocado +14% from Sep 14
    if (it.id === 'v-avo-fp' && d >= 86) c *= 1.03;
    if (it.id === 'v-chz-sy' && d >= 83) c *= 1.055;     // Sysco cheese +5.5% from Sep 21
    if (it.id === 'v-steak-sy' && d >= 55) c *= 1.025;
    arr.push(Math.round(c * 1000) / 1000);
  }
  INV_ITEM_COST[it.id] = arr;
});
function invIngCost(ingId, d){ return INV_ING_BY_ID[ingId].items.reduce((s, it) => s + it.share * INV_ITEM_COST[it.id][d], 0); }

/* ---- ideal (theoretical) usage per ingredient per day = menu mix x recipe ---- */
const INV_THEO_DAY = {};
INV_INGREDIENTS.forEach(ing => { INV_THEO_DAY[ing.id] = new Array(INV_DAYS + 1).fill(0); });
INV_MENU_DAILY.forEach(r => {
  const m = INV_MENU_BY_ID[r.menuId];
  Object.keys(m.recipe).forEach(ing => {
    INV_THEO_DAY[ing][r.day] += r.units * m.recipe[ing];
    r.theoCost += r.units * m.recipe[ing] * invIngCost(ing, r.day);
  });
  r.theoCost = inv2(r.theoCost);
});
INV_INGREDIENTS.filter(i => i.copyAct).forEach(ing => {     // non-recipe supplies track sales
  for (let d = 1; d <= INV_DAYS; d++) INV_THEO_DAY[ing.id][d] = INV_DAY_SALES[d] / 1000 * ing.perK * (1 + invNoise(0.08));
});

/* ---- inventory counts (EOInvMain). Daily counts every close, Weekly on
   Sundays, Monthly at month end. Opening = previous count of the same
   frequency, so a missed count stretches the next count's period. ---- */
const INV_FREQ_ORDER = { Daily:0, Weekly:1, Monthly:2 };
const invCountedIn = (ingFreq, freq) => INV_FREQ_ORDER[ingFreq] <= INV_FREQ_ORDER[freq];   // monthly = full count
const INV_COUNT_DAYS = {
  Daily:   (() => { const a = []; for (let d = 1; d <= INV_DAYS; d++) if (d !== 68 && d !== 82) a.push(d); return a; })(),  // Sep 6 + Sep 20 missed
  Weekly:  (() => { const a = []; for (let d = 1; d <= INV_DAYS; d++) if (invDow(d) === 0 && d !== 47) a.push(d); return a; })(), // Aug 16 missed
  Monthly: [31, 62, 92],
};
const INV_UNFINALIZED = { 'Daily|92':true, 'Weekly|89':true };
const INV_FINALIZERS = { Daily:['Kimberli Lopez','Tyler Brooks','Mei Tanaka'], Weekly:['Graciela Atempa','Marcus Bell'], Monthly:['Daniel Reyes'] };
const INV_COUNTS = [];
Object.keys(INV_COUNT_DAYS).forEach(freq => {
  let prev = 0;
  INV_COUNT_DAYS[freq].forEach((d, i) => {
    const unf = !!INV_UNFINALIZED[freq + '|' + d];
    let sales = 0; for (let k = prev + 1; k <= d; k++) sales += INV_DAY_SALES[k];
    INV_COUNTS.push({ id:freq[0] + d, freq, day:d, openDay:prev, ord:i, days:d - prev, sales:inv2(sales),
      status: unf ? 'Un-Finalized' : 'Finalized', finBy: unf ? '' : INV_FINALIZERS[freq][i % INV_FINALIZERS[freq].length],
      missed: freq === 'Daily' ? d - prev - 1 : freq === 'Weekly' ? Math.round((d - prev) / 7) - 1 : 0 });
    prev = d;
  });
});
const INV_COUNT_BY_ID = {}; INV_COUNTS.forEach(c => { INV_COUNT_BY_ID[c.id] = c; });

/* ---- transfers with the sister store (EOTrfMain) ---- */
const INV_TRANSFERS = [
  { day:22, id:'55012', dir:'out', item:'v-shr-us',  qty:10,  store:'012 - Carlsbad' },
  { day:50, id:'55101', dir:'in',  item:'v-chz-sy',  qty:10,  store:'012 - Carlsbad' },
  { day:64, id:'55188', dir:'out', item:'v-boat-us', qty:1000, store:'012 - Carlsbad' },
  { day:85, id:'56590', dir:'in',  item:'v-cod-pf',  qty:10,  store:'012 - Carlsbad' },
  { day:88, id:'56653', dir:'in',  item:'v-ft-us',   qty:96,  store:'012 - Carlsbad' },
];
INV_TRANSFERS.forEach(t => { t.amount = inv2(t.qty * INV_ITEM_COST[t.item][t.day]); t.status = 'Finalized'; });

/* ---- daily simulation per supplier item ----
   Built-in stories a store manager should find:
     - Shrimp over-portioning: actual runs 7% -> 12% over ideal from Sep 7
     - Carne asada: unexplained shrink (+8%) in the last 10 days of September
     - Avocado spoilage: waste jumps from Sep 14 while FreshPoint's price rises
     - Flour tortillas: US Foods short-shipped Sep 25 -> below PAR on the
       Sep 27 count, covered by a transfer in from 012 - Carlsbad
     - Foil sheets: an over-order on Aug 27 leaves weeks of stock on hand
     - Fountain syrup reads under ideal (-5%), and the Sep 13 weekly count
       was over-counted (9 BIBs counted twice) -> negative usage that week, a spike the next
     - Missed counts: daily Sep 6 + Sep 20, weekly Aug 16 */
const INV_DC_WEEKDAYS = { 'sysco-sd':[1,3,5], 'sysco-la':[4], 'usf-lm':[2,5], 'pfg-sc':[3], 'fresh-sd':[1,3,6], 'pepsi-cb':[2] };
const INV_SHORT_SHIP = { 'v-ft-us':{ from:87, keep:0 }, 'v-crm-us':{ from:84, minus:1 }, 'v-cab-fp':{ from:71, minus:1 } };
const INV_SIM = {};
INV_ITEMS.forEach(it => {
  const ing = INV_ING_BY_ID[it.ingredient];
  const wd = INV_DC_WEEKDAYS[it.dc];
  const theo = INV_THEO_DAY[ing.id].map(v => v * it.share);
  const avgDaily = theo.slice(1).reduce((a, b) => a + b, 0) / INV_DAYS;
  const minPar = inv2(avgDaily * ing.parDays);
  const maxPar = inv2(avgDaily * ing.parDays * 1.6 + it.pack * 0.5);
  const overQty = inv2(ing.freq === 'Monthly' ? maxPar + avgDaily * 30 : maxPar * 1.8);
  const s = { minPar, maxPar, overQty, onHand:[inv2(maxPar * 0.85)], delv:[0], ord:[0], tin:[0], tout:[0], waste:[0], theo, short:{} };
  const ss = INV_SHORT_SHIP[it.id];
  let ssUsed = false;
  for (let d = 1; d <= INV_DAYS; d++) {
    let oh = s.onHand[d - 1], ordC = 0, recvC = 0;
    if (wd.indexOf(invDow(d)) >= 0) {
      let gap = 1; while (wd.indexOf(invDow(d + gap)) < 0) gap++;
      if (oh - avgDaily * gap < minPar || (ss && !ssUsed && d >= ss.from)) {
        ordC = Math.max(1, Math.ceil((maxPar + avgDaily * gap - oh) / it.pack));
        recvC = ordC;
        if (ss && !ssUsed && d >= ss.from) { recvC = ss.keep != null ? Math.min(ordC, ss.keep) : Math.max(0, ordC - ss.minus); ssUsed = true; s.short[d] = true; }
      }
      if (it.id === 'v-foil-sy' && d === 58) { ordC += 3; recvC += 3; }     // the foil over-order
    }
    const tIn = INV_TRANSFERS.filter(t => t.item === it.id && t.dir === 'in' && t.day === d).reduce((a, t) => a + t.qty, 0);
    const tOut = INV_TRANSFERS.filter(t => t.item === it.id && t.dir === 'out' && t.day === d).reduce((a, t) => a + t.qty, 0);
    // true usage vs ideal
    let dev = 0.012 + invNoise(0.02);
    if (ing.id === 'shrimp' && d >= 69) dev += 0.07 + 0.05 * (d - 69) / 23;
    if (ing.id === 'steak' && d >= 83) dev += 0.08;
    if (ing.id === 'syrup') dev = -0.05 + invNoise(0.01);
    if (ing.id === 'cod' && d >= 20 && d <= 31) dev += 0.03;
    if (ing.copyAct) dev = 0;
    let wRate = ing.waste * (1 + invNoise(0.4));
    if (ing.id === 'avocado' && d >= 76) wRate = d >= 83 ? 0.115 : 0.085;
    if (ing.id === 'cilantro' && d >= 76) wRate = 0.09;
    const wasteQ = theo[d] * wRate;
    const use = theo[d] * (1 + dev) + wasteQ;
    oh = oh + recvC * it.pack + tIn - tOut - use;
    if (oh < 0) oh = 0;
    s.onHand.push(oh); s.delv.push(recvC * it.pack); s.ord.push(ordC * it.pack); s.tin.push(tIn); s.tout.push(tOut); s.waste.push(wasteQ);
  }
  INV_SIM[it.id] = s;
});

/* counted quantity on a count date: the shelf (tiny counting noise),
   rounded the way a count sheet is filled in */
function invCountQty(itemId, d, freq){
  const it = INV_ITEM_BY_ID[itemId], ing = INV_ING_BY_ID[it.ingredient];
  let q = INV_SIM[itemId].onHand[d] * (1 + (d ? invHashNoise(itemId + '|' + d, 0.004) : 0));
  if (itemId === 'v-syr-pe' && d === 75 && freq === 'Weekly') q += 45;   // Sep 13: 9 BIBs counted twice
  if (ing.unit === 'ea' || ing.unit === 'box' || ing.unit === 'can' || ing.unit === 'bunch') return Math.round(q);
  return Math.round(q * 4) / 4;
}

/* ---- leaf records: supplier item x inventory count (EOInvVitDetail) ---- */
const INV_RECORDS = [];
INV_COUNTS.forEach(c => {
  INV_ITEMS.forEach(it => {
    const ing = INV_ING_BY_ID[it.ingredient];
    if (!invCountedIn(ing.freq, c.freq)) return;
    const s = INV_SIM[it.id], cost = INV_ITEM_COST[it.id];
    const o = c.openDay, d = c.day;
    let delv = 0, ord = 0, tin = 0, tout = 0, waste = 0, theo = 0, delvCost = 0, ordCost = 0, wasteCost = 0, tinCost = 0, toutCost = 0, short = false;
    const drops = [];
    for (let k = o + 1; k <= d; k++) {
      delv += s.delv[k]; ord += s.ord[k]; tin += s.tin[k]; tout += s.tout[k]; waste += s.waste[k]; theo += s.theo[k];
      delvCost += s.delv[k] * cost[k]; ordCost += s.ord[k] * cost[k]; wasteCost += s.waste[k] * cost[k];
      tinCost += s.tin[k] * cost[k]; toutCost += s.tout[k] * cost[k];
      if (s.delv[k] > 0) drops.push(k);
      if (s.short[k]) short = true;
    }
    const open = invCountQty(it.id, o, c.freq), close = invCountQty(it.id, d, c.freq);
    const act = inv2(open + delv + tin - tout - close);
    const theoQ = ing.copyAct ? act : inv2(theo);
    const cd = cost[d];
    INV_RECORDS.push({
      invId:c.id, freq:c.freq, day:d, openDay:o, itemId:it.id, ingredient:ing.id, category:ing.cat, type:INV_CAT_BY_ID[ing.cat].type,
      loc:ing.loc, supplier:it.sup, dc:it.dc, unit:ing.unit, unitCost:cd, prevCost:cost[o],
      minPar:s.minPar, maxPar:s.maxPar, overQty:s.overQty,
      openQty:open, delvQty:inv2(delv), trfInQty:inv2(tin), trfOutQty:inv2(tout), wasteQty:inv2(waste), closeQty:close,
      actQty:act, theoQty:theoQ, ordQty:inv2(ord), short, drops,
      openCost:inv2(open * cost[o]), delvCost:inv2(delvCost), ordCost:inv2(ordCost), trfInCost:inv2(tinCost), trfOutCost:inv2(toutCost),
      wasteCost:inv2(wasteCost), closeCost:inv2(close * cd), actCost:inv2(act * cd), theoCost:inv2(theoQ * cd), varLimit:ing.varLimit,
    });
  });
});

/* ---- menu mix per inventory count period ---- */
const INV_MENU_RECORDS = [];
INV_COUNTS.forEach(c => {
  INV_MENU.forEach(m => {
    let units = 0, sales = 0, theoCost = 0;
    INV_MENU_DAILY.forEach(r => { if (r.menuId === m.id && r.day > c.openDay && r.day <= c.day) { units += r.units; sales += r.sales; theoCost += r.theoCost; } });
    INV_MENU_RECORDS.push({ invId:c.id, freq:c.freq, day:c.day, menuId:m.id, units, sales:inv2(sales), theoCost:inv2(theoCost) });
  });
});

/* ---- events for the Inventory Breakdown pop-up ---- */
// supplier deliveries: one invoice per DC per delivery day (EODvlInvoice)
const INV_INVOICES = [];
(function(){
  let num = 517790000;
  for (let d = 1; d <= INV_DAYS; d++) {
    INV_DCS.forEach(dc => {
      const lines = INV_ITEMS.filter(it => it.dc === dc.id && INV_SIM[it.id].delv[d] > 0);
      if (!lines.length) return;
      num += 1100 + Math.floor(invRand() * 900);
      const amount = lines.reduce((a, it) => a + INV_SIM[it.id].delv[d] * INV_ITEM_COST[it.id][d], 0);
      INV_INVOICES.push({ day:d, dc:dc.id, supplier:dc.supplier, num:String(num), lines:lines.length, amount:inv2(amount),
        short: lines.some(it => INV_SIM[it.id].short[d]), status: d >= 91 ? 'Pending' : 'Finalized' });
    });
  }
})();
// waste log per day (EOWstMain, reasons from EOWstReason)
const INV_WASTE_LOGS = [];
for (let d = 1; d <= INV_DAYS; d++) {
  const by = { 'Spoiled':0, 'Dropped/Spilled':0, 'Others':0 };
  INV_ITEMS.forEach(it => {
    const v = INV_SIM[it.id].waste[d] * INV_ITEM_COST[it.id][d];
    if (!v) return;
    const cat = INV_ING_BY_ID[it.ingredient].cat;
    if (cat === 'produce' || cat === 'dairy') by['Spoiled'] += v;
    else if (cat === 'seafood' || cat === 'meat') { by['Dropped/Spilled'] += v * 0.6; by['Others'] += v * 0.4; }
    else by['Others'] += v;
  });
  const amount = by['Spoiled'] + by['Dropped/Spilled'] + by['Others'];
  if (amount > 0) INV_WASTE_LOGS.push({ day:d, id:'W' + (31200 + d), amount:inv2(amount), by, type:'Manual', status:'Finalized' });
}
// menu mix per day (profit % = sales less ideal cost)
function invDayMenuMix(d){
  const rs = INV_MENU_DAILY.filter(r => r.day === d);
  const sales = rs.reduce((a, r) => a + r.sales, 0), cost = rs.reduce((a, r) => a + r.theoCost, 0);
  return { day:d, units:rs.reduce((a, r) => a + r.units, 0), profit: sales ? (sales - cost) / sales * 100 : 0, status: d >= 92 ? 'Un-Finalized' : 'Finalized' };
}
function invSalesUpdatedAt(d){
  if (d >= INV_DAYS) return '10/01/2026 05:33 AM';
  const mins = 2 + Math.floor(Math.abs(invHashNoise('upd' + d, 1)) * 9);
  return invMDY(d + 1) + ' 10:0' + mins + ' PM';
}

/* ---- per-record exception rules ---- */
const INV_RULES = { minVarDollar:15, highWastePct:6, minWasteDollar:20, priceAlertPct:4, fillRate:95 };
function invRecordWarnings(r){
  const w = [];
  const varD = r.actCost - r.theoCost;
  if (r.actQty < -0.005) w.push('Negative usage');
  else if (r.theoCost > 0 && Math.abs(varD) >= INV_RULES.minVarDollar && Math.abs(varD / r.theoCost * 100) > r.varLimit) w.push('High variance');
  if (r.actCost > 0 && r.wasteCost >= INV_RULES.minWasteDollar && r.wasteCost / r.actCost * 100 > INV_RULES.highWastePct) w.push('High waste');
  if (r.closeQty < r.minPar) w.push('Below PAR');
  if (r.prevCost && (r.unitCost / r.prevCost - 1) * 100 > INV_RULES.priceAlertPct) w.push('Price alert');
  if (r.short || (r.ordQty > 0 && r.delvQty / r.ordQty * 100 < INV_RULES.fillRate)) w.push('Short shipped');
  if (r.closeQty > r.overQty) w.push('Overstock');
  return w;
}

/* ---- aggregation: any subset of leaf records -> every inventory KPI.
   Several counts roll up like one long period: opening of the earliest,
   closing of the latest, flows summed, sales of each count period. ---- */
function invAggregate(records){
  const a = { netSales:0, actCost:0, theoCost:0, variance:0, purchases:0, ordCost:0, wasteCost:0, trfInCost:0, trfOutCost:0, trfNet:0,
    invValue:0, openValue:0, daysOnHand:0, actPct:0, theoPct:0, varPct:0, varIdeal:0, wastePct:0, fillRate:0,
    itemCount:0, ingCount:0, belowPar:0, highVar:0, deliveries:0, priceChg:0, priceImpact:0, warnCount:0, invCount:0, finCount:0,
    openQty:0, delvQty:0, trfInQty:0, trfOutQty:0, wasteQty:0, closeQty:0, actQty:0, theoQty:0, varQty:0, parQty:0, sugOrder:0, unitCost:0,
    days:0, status:'', finBy:'' };
  if (!records.length) return a;
  const invs = new Set(), items = {}, ings = {}, drops = new Set();
  records.forEach(r => {
    invs.add(r.invId);
    a.actCost += r.actCost; a.theoCost += r.theoCost; a.purchases += r.delvCost; a.ordCost += r.ordCost;
    a.wasteCost += r.wasteCost; a.trfInCost += r.trfInCost; a.trfOutCost += r.trfOutCost;
    a.delvQty += r.delvQty; a.trfInQty += r.trfInQty; a.trfOutQty += r.trfOutQty; a.wasteQty += r.wasteQty;
    a.actQty += r.actQty; a.theoQty += r.theoQty;
    a.warnCount += invRecordWarnings(r).length;
    const it = items[r.itemId] || (items[r.itemId] = { first:r, last:r, use:0 });
    if (r.day < it.first.day) it.first = r;
    if (r.day > it.last.day) it.last = r;
    it.use += r.actQty;
    a.priceImpact += (r.unitCost - r.prevCost) * r.delvQty;
    const g = ings[r.ingredient] || (ings[r.ingredient] = { act:0, theo:0, limit:r.varLimit });
    g.act += r.actCost; g.theo += r.theoCost;
    r.drops.forEach(k => drops.add(r.dc + '|' + k));
  });
  invs.forEach(id => { const c = INV_COUNT_BY_ID[id]; a.netSales += c.sales; a.days += c.days; if (c.status === 'Finalized') a.finCount++; });
  a.invCount = invs.size;
  if (invs.size === 1) { const c = INV_COUNT_BY_ID[Array.from(invs)[0]]; a.status = c.status; a.finBy = c.finBy; }
  a.variance = a.actCost - a.theoCost;
  a.trfNet = a.trfInCost - a.trfOutCost;
  let pNum = 0, pDen = 0;
  Object.keys(items).forEach(id => {
    const it = items[id], item = INV_ITEM_BY_ID[id];
    a.invValue += it.last.closeCost; a.openValue += it.first.openCost;
    a.openQty += it.first.openQty; a.closeQty += it.last.closeQty; a.parQty += it.last.minPar;
    if (it.last.closeQty < it.last.minPar) a.belowPar++;
    const gap = it.last.maxPar - it.last.closeQty;
    if (it.last.closeQty < it.last.minPar * 1.5 && gap > 0) a.sugOrder += Math.ceil(gap / item.pack) * item.pack;
    const base = it.first.prevCost, wgt = Math.max(Math.abs(it.use), 0.01) * base;
    pNum += (it.last.unitCost / base - 1) * wgt; pDen += wgt;
  });
  a.priceChg = pDen ? pNum / pDen * 100 : 0;
  a.itemCount = Object.keys(items).length;
  a.ingCount = Object.keys(ings).length;
  a.highVar = Object.keys(ings).filter(k => { const g = ings[k]; return g.theo > 0 && Math.abs(g.act - g.theo) >= INV_RULES.minVarDollar && Math.abs((g.act - g.theo) / g.theo * 100) > g.limit; }).length;
  a.deliveries = drops.size;
  a.varQty = a.actQty - a.theoQty;
  a.daysOnHand = a.actCost > 0 ? a.invValue / (a.actCost / a.days) : 0;
  a.actPct = a.netSales ? a.actCost / a.netSales * 100 : 0;
  a.theoPct = a.netSales ? a.theoCost / a.netSales * 100 : 0;
  a.varPct = a.netSales ? a.variance / a.netSales * 100 : 0;
  a.varIdeal = a.theoCost ? a.variance / a.theoCost * 100 : 0;
  a.wastePct = a.netSales ? a.wasteCost / a.netSales * 100 : 0;
  a.fillRate = a.ordCost ? a.purchases / a.ordCost * 100 : 100;
  a.unitCost = a.itemCount === 1 ? records.reduce((m, r) => r.day >= m.day ? r : m, records[0]).unitCost : (a.actQty ? a.actCost / a.actQty : 0);
  return a;
}

/* ---- menu-level aggregation (Menu Item level) ---- */
function invMenuAggregate(records, scopeIngs){
  const a = { menuUnits:0, menuSales:0, menuTheo:0, plateCost:0, salesMix:0, ingCost:0, ingQty:0, invCount:0, status:'', finBy:'' };
  if (!records.length) return a;
  const invs = new Set();
  records.forEach(r => {
    invs.add(r.invId);
    a.menuUnits += r.units; a.menuSales += r.sales; a.menuTheo += r.theoCost;
    if (scopeIngs) {
      const m = INV_MENU_BY_ID[r.menuId], c = INV_COUNT_BY_ID[r.invId];
      scopeIngs.forEach(ing => { if (m.recipe[ing]) { const q = r.units * m.recipe[ing]; a.ingQty += q; a.ingCost += q * invIngCost(ing, c.day); } });
    }
  });
  let sales = 0; invs.forEach(id => { sales += INV_COUNT_BY_ID[id].sales; });
  a.invCount = invs.size;
  if (invs.size === 1) { const c = INV_COUNT_BY_ID[Array.from(invs)[0]]; a.status = c.status; a.finBy = c.finBy; }
  a.plateCost = a.menuSales ? a.menuTheo / a.menuSales * 100 : 0;
  a.salesMix = sales ? a.menuSales / sales * 100 : 0;
  return a;
}

/* ---- KPI / column metadata. dir: 'up' = higher is good, 'down' = higher is bad ---- */
const INV_KPI_DEFS = [
  { id:'netSales',   label:'Sales $',            fmt:'dollar',  accent:'#0891b2', dir:'up' },
  { id:'actCost',    label:'Actual $',           fmt:'dollar',  accent:'#8b4fbe' },
  { id:'actPct',     label:'Act. Usage %',       fmt:'percent', accent:'#f4685b', dir:'down', target:32.0, thresholdPct:0.5, info:'Actual usage $ ÷ sales $' },
  { id:'theoCost',   label:'Ideal $',            fmt:'dollar',  accent:'#12a37f', info:'Menu mix exploded through recipes' },
  { id:'theoPct',    label:'Ideal Usage %',      fmt:'percent', accent:'#12a37f' },
  { id:'variance',   label:'Variance $',         fmt:'dollar',  accent:'#e11d48', dir:'down', signed:true, info:'Actual − Ideal (positive = used more than recipes say)' },
  { id:'varPct',     label:'Variance %',         fmt:'pts',     accent:'#e11d48', dir:'down', target:1.0, info:'Variance $ ÷ sales $' },
  { id:'varIdeal',   label:'Var. % of Ideal',    fmt:'percent', accent:'#e11d48', dir:'down', info:'Variance $ ÷ ideal $ — compared with each item\'s variance limit' },
  { id:'purchases',  label:'Deliveries $',       fmt:'dollar',  accent:'#4d8cf5', info:'Received supplier deliveries (invoice $)' },
  { id:'wasteCost',  label:'Waste $',            fmt:'dollar',  accent:'#d97706', dir:'down' },
  { id:'wastePct',   label:'Waste %',            fmt:'percent', accent:'#d97706', dir:'down', target:0.55 },
  { id:'trfNet',     label:'Net Transfer $',     fmt:'dollar',  accent:'#64748b', info:'Transfer in − transfer out (sister store 012 - Carlsbad)' },
  { id:'invValue',   label:'Inv. Value',         fmt:'dollar',  accent:'#4f46e5', info:'Closing count value of the latest inventory' },
  { id:'daysOnHand', label:'Days On Hand',       fmt:'days',    accent:'#0f766e', info:'Inventory value ÷ average daily actual usage $' },
  { id:'itemCount',  label:'Items',              fmt:'count',   accent:'#4f46e5' },
  { id:'invCount',   label:'Inventories',        fmt:'count',   accent:'#4f46e5' },
  { id:'belowPar',   label:'Below PAR',          fmt:'count',   accent:'#dc2626', dir:'down', target:0 },
  { id:'highVar',    label:'High Var. Items',    fmt:'count',   accent:'#e11d48', dir:'down', target:0 },
  { id:'fillRate',   label:'Fill Rate',          fmt:'percent', accent:'#0891b2', dir:'up', target:98, lowerIsBad:true, info:'Received $ ÷ ordered $' },
  { id:'deliveries', label:'Invoices',           fmt:'count',   accent:'#4d8cf5' },
  { id:'priceChg',   label:'Price Change',       fmt:'percent', accent:'#be123c', dir:'down', signed:true, info:'Unit cost on the latest count vs the opening count' },
  { id:'priceImpact',label:'Price Impact $',     fmt:'dollar',  accent:'#be123c', dir:'down', info:'Extra $ paid on received qty because of price moves' },
  { id:'warnCount',  label:'Warnings',           fmt:'count',   accent:'#d97706', dir:'down', target:0 },
  { id:'status',     label:'Status',             fmt:'text',    accent:'#64748b' },
  { id:'finBy',      label:'Finalized By',       fmt:'text',    accent:'#64748b' },
  // quantity columns (single ingredient / item rows only)
  { id:'openQty',    label:'Opening Inv.',       fmt:'qty',     accent:'#64748b' },
  { id:'delvQty',    label:'Deliveries',         fmt:'qty',     accent:'#4d8cf5' },
  { id:'trfInQty',   label:'Transfer In',        fmt:'qty',     accent:'#64748b' },
  { id:'trfOutQty',  label:'Transfer Out',       fmt:'qty',     accent:'#64748b' },
  { id:'closeQty',   label:'Closing Inv.',       fmt:'qty',     accent:'#4f46e5' },
  { id:'actQty',     label:'Actual Usage',       fmt:'qty',     accent:'#8b4fbe' },
  { id:'theoQty',    label:'Ideal Usage',        fmt:'qty',     accent:'#12a37f' },
  { id:'varQty',     label:'Variance',           fmt:'qty',     accent:'#e11d48', dir:'down', signed:true },
  { id:'wasteQty',   label:'Waste',              fmt:'qty',     accent:'#d97706', dir:'down' },
  { id:'parQty',     label:'Min PAR',            fmt:'qty',     accent:'#64748b' },
  { id:'sugOrder',   label:'Suggested Order',    fmt:'qty',     accent:'#0f766e', info:'Up to max PAR, in whole cases' },
  { id:'unitCost',   label:'Cost $',             fmt:'unitcost',accent:'#64748b' },
  // menu columns
  { id:'menuUnits',  label:'Units Sold',         fmt:'count',   accent:'#0891b2', dir:'up' },
  { id:'menuSales',  label:'Menu Sales',         fmt:'dollar',  accent:'#0891b2', dir:'up' },
  { id:'salesMix',   label:'Sales Mix',          fmt:'percent', accent:'#4d8cf5' },
  { id:'menuTheo',   label:'Ideal Cost $',       fmt:'dollar',  accent:'#12a37f' },
  { id:'plateCost',  label:'Plate Cost %',       fmt:'percent', accent:'#f4685b', dir:'down', info:'Ideal recipe cost ÷ menu price' },
  { id:'ingCost',    label:'Ingredient Ideal $', fmt:'dollar',  accent:'#8b4fbe', info:'Ideal usage of the drilled ingredient(s) inside this menu item' },
];

if (typeof window !== 'undefined') {
  Object.assign(window, { INV_DAY0, INV_DAYS, INV_TYPES, INV_CATEGORIES, INV_FREQS, INV_SUPPLIERS, INV_DCS, INV_INGREDIENTS, INV_MENU, INV_ITEMS,
    INV_COUNTS, INV_RECORDS, INV_MENU_RECORDS, INV_DAY_SALES, INV_INVOICES, INV_TRANSFERS, INV_WASTE_LOGS, INV_KPI_DEFS,
    invAggregate, invMenuAggregate, invRecordWarnings, invDate, invMDY, invMonDay });
}

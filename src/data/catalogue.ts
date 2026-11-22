import type { ImageMetadata } from 'astro'

import medicalEquipment from '../assets/products/medical-equipment.jpg'
import monitorsUltrasound from '../assets/products/monitors-ultrasound.jpg'
import radiology from '../assets/products/radiology.jpg'
import surgicalInstruments from '../assets/products/surgical-instruments.jpg'
import anaesthesia from '../assets/products/anaesthesia.jpg'
import operatingTable from '../assets/products/operating-table.jpg'
import patientPositioning from '../assets/products/patient-positioning.jpg'
import theatreSeating from '../assets/products/theatre-seating.jpg'
import ivStandsTrolleys from '../assets/products/iv-stands-trolleys.jpg'
import surgicalWear from '../assets/products/surgical-wear.jpg'
import hospitalFurniture from '../assets/products/hospital-furniture.jpg'
import patientTrolleys from '../assets/products/patient-trolleys.jpg'
import firstAid from '../assets/products/first-aid.jpg'
import packingTable from '../assets/products/packing-table.jpg'
import pouchSealer from '../assets/products/pouch-sealer.jpg'
import autoclave from '../assets/products/autoclave.jpg'
import sterileShelving from '../assets/products/sterile-shelving.jpg'
import stainlessFurniture from '../assets/products/stainless-furniture.jpg'
import medicalFridges from '../assets/products/medical-fridges.jpg'
import gloves from '../assets/products/gloves.jpg'
import gauzeBandages from '../assets/products/gauze-bandages.jpg'
import infectionControl from '../assets/products/infection-control.jpg'
import wasteContainers from '../assets/products/waste-containers.jpg'
import uniforms from '../assets/products/uniforms.jpg'
import shoes from '../assets/products/shoes.jpg'
import labGlassware from '../assets/products/lab-glassware.jpg'

export interface Category {
  slug: string
  name: string
  /** What the catalogue photo shows, in plain words. */
  shown: string
  image: ImageMetadata
  alt: string
  /** Item-level lists, where the company profile gives them. */
  items?: string[]
  /** A service attached to this category, where the profile states one. */
  service?: string
}

export interface Department {
  slug: string
  name: string
  short: string
  summary: string
  intro: string
  image: ImageMetadata
  alt: string
  /**
   * How the photo sits in a round frame: `contain` for cut-outs on white
   * (kept clear of the curved edge), `cover` for full photos (filled edge to
   * edge, so no rectangle shows inside the circle).
   */
  fit: 'contain' | 'cover'
  categories: Category[]
}

export const departments: Department[] = [
  {
    slug: 'diagnostics',
    name: 'Diagnostics and monitoring',
    short: 'Diagnostics',
    summary: 'Patient monitors, ultrasound, ECG and radiology equipment.',
    intro:
      'Bedside and theatre monitoring, ultrasound scanning and imaging. If you are replacing a unit, add the make and model to your quote list so we can quote the right equipment.',
    image: medicalEquipment,
    alt: 'Ultrasound scanner, patient monitor and ECG machine',
    fit: 'contain',
    categories: [
      {
        slug: 'medical-equipment',
        name: 'Medical equipment',
        shown: 'Ultrasound scanner on a trolley, multi-parameter patient monitor and a 12-lead ECG machine.',
        image: medicalEquipment,
        alt: 'Ultrasound scanner, patient monitor and ECG machine',
      },
      {
        slug: 'patient-monitors-ultrasound',
        name: 'Patient monitors and ultrasound',
        shown: 'Cart-based ultrasound system with probes, and a portable patient monitor with a carry handle.',
        image: monitorsUltrasound,
        alt: 'Cart-based ultrasound system and a portable patient monitor',
      },
      {
        slug: 'radiology',
        name: 'Radiology products',
        shown: 'C-arm X-ray system with its viewing monitors.',
        image: radiology,
        alt: 'C-arm X-ray system with a monitor cart',
      },
    ],
  },
  {
    slug: 'theatre',
    name: 'Theatre and surgery',
    short: 'Theatre',
    summary: 'Instruments, anaesthesia products, operating tables and theatre seating.',
    intro:
      'From the instrument tray to the table. Instruments, anaesthesia consumables, tables, positioning, seating and the stands and trolleys around them.',
    image: surgicalInstruments,
    alt: 'Rows of stainless steel surgical instruments',
    fit: 'cover',
    categories: [
      {
        slug: 'surgical-instruments',
        name: 'Surgical instruments',
        shown: 'Forceps, scissors, needle holders, retractors and clamps in stainless steel.',
        image: surgicalInstruments,
        alt: 'Rows of stainless steel surgical instruments',
      },
      {
        slug: 'anaesthesia',
        name: 'Anaesthesia products',
        shown: 'Breathing bags, breathing circuits, face masks, filters and airway connectors.',
        image: anaesthesia,
        alt: 'Anaesthesia breathing bags, circuits, a face mask and connectors',
      },
      {
        slug: 'operating-tables',
        name: 'Operating tables',
        shown: 'Electric operating table on a stainless column with a hand control.',
        image: operatingTable,
        alt: 'Operating table with a black mattress on a stainless steel column',
      },
      {
        slug: 'patient-positioning',
        name: 'Patient positioning',
        shown: 'Positioning system with head, arm and shoulder supports for the operating table.',
        image: patientPositioning,
        alt: 'Patient positioning system with head and arm supports',
      },
      {
        slug: 'theatre-seating',
        name: 'Stools and chairs',
        shown: 'Surgeon chair with arm supports, and a height-adjustable stool on castors.',
        image: theatreSeating,
        alt: 'Blue surgeon chair with arm supports next to a black stool',
      },
      {
        slug: 'iv-stands-trolleys',
        name: 'IV stands and instrument trolleys',
        shown: 'IV stand on a five-castor base, and a stainless Mayo instrument trolley.',
        image: ivStandsTrolleys,
        alt: 'IV stand and stainless steel Mayo instrument trolley',
      },
      {
        slug: 'surgical-wear',
        name: 'Surgical wear',
        shown: 'Surgical gowns, bouffant caps and shoe covers.',
        image: surgicalWear,
        alt: 'Blue surgical gowns, a cap and shoe covers',
      },
    ],
  },
  {
    slug: 'wards',
    name: 'Wards and patient care',
    short: 'Wards',
    summary: 'Hospital beds, trolleys, plinths, wheelchairs and first aid.',
    intro: 'Furniture and equipment for wards, emergency rooms and consulting rooms, plus first aid kits for any workplace.',
    image: hospitalFurniture,
    alt: 'Hospital bed, emergency trolley, IV stand, wheelchair and scale',
    fit: 'contain',
    categories: [
      {
        slug: 'hospital-furniture',
        name: 'Hospital furniture',
        shown: 'Hospital bed with side rails, emergency trolley with drawers, IV stand, wheelchair and a height and weight scale.',
        image: hospitalFurniture,
        alt: 'Hospital bed, emergency trolley, IV stand, wheelchair and scale',
      },
      {
        slug: 'patient-trolleys-plinths',
        name: 'Patient trolleys and plinths',
        shown: 'Three-section examination plinth, and a patient transfer trolley with side rails.',
        image: patientTrolleys,
        alt: 'Examination plinth above a patient transfer trolley',
      },
      {
        slug: 'first-aid',
        name: 'First aid kits and cabinets',
        shown: 'First aid bags in two sizes, an opened kit and a wall-mounted first aid cabinet.',
        image: firstAid,
        alt: 'Red first aid bags, an open kit and a wall cabinet',
      },
    ],
  },
  {
    slug: 'sterile-services',
    name: 'Sterile services and storage',
    short: 'Sterile services',
    summary: 'Packing tables, pouch sealers, autoclaves, sterile shelving and medical fridges.',
    intro:
      'Equipment for each step of a sterile services department, from the packing bench to the storage shelf. We also install autoclaves and maintain them.',
    image: autoclave,
    alt: 'Floor-standing autoclave with a control panel',
    fit: 'cover',
    categories: [
      {
        slug: 'packing-tables',
        name: 'Packing tables',
        shown: 'Stainless packing table with an overhead shelf, wrap holder and wire undershelf.',
        image: packingTable,
        alt: 'Stainless steel packing table with shelves',
      },
      {
        slug: 'pouch-sealers',
        name: 'Pouch sealers',
        shown: 'Continuous heat sealer for sterilisation pouches, with a roller feed.',
        image: pouchSealer,
        alt: 'Continuous heat sealer with pouch rolls',
      },
      {
        slug: 'autoclaves',
        name: 'Autoclaves',
        shown: 'Floor-standing steam autoclave with a touch control panel.',
        image: autoclave,
        alt: 'Floor-standing autoclave with a control panel',
        service: 'Installation and maintenance',
      },
      {
        slug: 'sterile-storage-shelving',
        name: 'Sterile storage and shelving',
        shown: 'Wire shelving units on castors for sterile stock.',
        image: sterileShelving,
        alt: 'Rows of wire shelving units on castors',
      },
      {
        slug: 'stainless-furniture',
        name: 'Stainless furniture',
        shown: 'Wall run of glass-fronted stainless steel storage cabinets.',
        image: stainlessFurniture,
        alt: 'Glass-fronted stainless steel cabinets holding sterile stock',
      },
      {
        slug: 'medical-fridges',
        name: 'Medical fridges',
        shown: 'Tall and under-counter medical fridges, with solid and glass doors.',
        image: medicalFridges,
        alt: 'Four medical fridges of different sizes',
      },
    ],
  },
  {
    slug: 'consumables',
    name: 'Consumables and PPE',
    short: 'Consumables',
    summary: 'Gloves, gauze, bandages, infection control, waste bins, uniforms and shoes.',
    intro: 'The stock that runs out first. Gloves, dressings, disinfectants, waste containers, uniforms and theatre shoes.',
    image: gloves,
    alt: 'Box of powder-free latex gloves with a glove beside it',
    fit: 'contain',
    categories: [
      {
        slug: 'gloves',
        name: 'Gloves',
        shown: 'Powder-free latex examination gloves, boxed.',
        image: gloves,
        alt: 'Box of powder-free latex gloves with a glove beside it',
      },
      {
        slug: 'gauze-bandages',
        name: 'Medical gauze and bandages',
        shown: 'Gauze rolls, gauze swabs, bandages and sterile dressing packs.',
        image: gauzeBandages,
        alt: 'Gauze roll, swabs, bandages and dressing packs',
      },
      {
        slug: 'infection-control',
        name: 'Infection control',
        shown: 'Chlorine disinfectant and detergent tablets, a spray bottle and test strips.',
        image: infectionControl,
        alt: 'Tubs of disinfectant tablets, a spray bottle and test strips',
      },
      {
        slug: 'medical-waste-containers',
        name: 'Medical waste containers',
        shown: 'Pedal-operated bin marked for medical waste, with the biohazard symbol.',
        image: wasteContainers,
        alt: 'Yellow pedal bin with a biohazard symbol',
      },
      {
        slug: 'uniforms',
        name: 'Uniforms and scrubs',
        shown: 'Scrub tops and trousers in several colours.',
        image: uniforms,
        alt: 'Six health workers in scrubs of different colours',
      },
      {
        slug: 'theatre-shoes',
        name: 'Theatre shoes',
        shown: 'Slip-on theatre clogs in several colours and prints.',
        image: shoes,
        alt: 'Theatre clogs in green, yellow, pink, blue, brown, grey and prints',
      },
    ],
  },
  {
    slug: 'laboratory',
    name: 'Laboratory ware and chemicals',
    short: 'Laboratory',
    summary: 'Lab chemicals, glassware and plasticware, listed item by item.',
    intro:
      'Chemicals in bulk and by grade, with the glass and plastic ware to measure, mix, filter and store them. Tick what you need and it goes on your quote list.',
    image: labGlassware,
    alt: 'Laboratory flasks and a Schott bottle holding blue and red liquids',
    fit: 'cover',
    categories: [
      {
        slug: 'lab-chemicals',
        name: 'Lab chemicals',
        shown: 'Bulk chemicals and laboratory grades.',
        image: labGlassware,
        alt: 'Laboratory flasks and bottles',
        items: [
          'Bulk chemicals',
          'Lab chemicals, AR/CP grade',
          'Lab chemicals, HPLC grade',
          'Powders and indicators',
        ],
      },
      {
        slug: 'lab-glassware',
        name: 'Lab glassware',
        shown: 'Bottles, flasks, beakers, pipettes, burettes and more.',
        image: labGlassware,
        alt: 'Laboratory flasks and bottles',
        items: [
          'Amber Schott bottle, GL45 cap',
          'Schott bottle, GL45 cap',
          'Glass beakers with spout',
          'Erlenmeyer flasks, glass',
          'Graduated pipettes',
          'Glass filter funnels',
          'Glass filtration sets',
          'Glass burettes',
          'Glass measuring cylinders',
          'Glass measuring jugs',
          'Glass reagent bottles',
          'Glass volumetric flasks',
          'Watch glasses',
          'Glass test tubes',
          'Glass stirring rods',
        ],
      },
      {
        slug: 'lab-plasticware',
        name: 'Lab plasticware',
        shown: 'Funnels, beakers, flasks, cylinders, jugs and bottles in plastic.',
        image: labGlassware,
        alt: 'Laboratory flasks and bottles',
        items: [
          'Plastic analytical funnels',
          'Plastic beakers with spout',
          'Plastic Erlenmeyer flasks',
          'Plastic measuring cylinders',
          'Plastic measuring jugs',
          'Plastic reagent bottles',
          'Plastic volumetric flasks',
          'Schott bottle caps, GL45',
          'Wash bottles',
        ],
      },
    ],
  },
]

export const allCategories = departments.flatMap((d) => d.categories.map((c) => ({ ...c, department: d })))

export const categoryCount = allCategories.length

export const labItemCount = departments
  .find((d) => d.slug === 'laboratory')!
  .categories.reduce((n, c) => n + (c.items?.length ?? 0), 0)

export const departmentBySlug = (slug: string) => departments.find((d) => d.slug === slug)

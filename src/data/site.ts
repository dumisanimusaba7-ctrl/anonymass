// Every fact on this site comes from the Optima Industrial Solutions
// company profile (Medical Supplies, 2024). Nothing here is invented: if a
// detail is not in the profile (opening hours, years trading, prices), the
// site does not state it.

export const company = {
  legalName: 'Optima Industrial Solutions Limited',
  shortName: 'Optima',
  division: 'Medical Supplies',
  profileYear: 2024,
}

export const address = {
  lines: ['Plot No. 1051, Accra Road', 'Light Industrial Area', 'Kitwe, Zambia'],
  street: 'Plot No. 1051, Accra Road, Light Industrial Area',
  town: 'Kitwe',
  country: 'Zambia',
  countryCode: 'ZM',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Plot 1051 Accra Road, Light Industrial Area, Kitwe, Zambia'),
}

export const phones = [
  { label: 'Mobile', display: '+260 966 897076', href: 'tel:+260966897076' },
  { label: 'Mobile', display: '+260 770 905057', href: 'tel:+260770905057' },
]

export const fax = { display: '+260 212 223013' }

// As printed in the company profile.
export const emails = ['info@optimaindustrialcom.com', 'optimal.prints@yahoo.com']

// WhatsApp goes to the first mobile number. Confirm this number is on
// WhatsApp before launch; change it here and every button follows.
export const whatsapp = {
  number: '260966897076',
  display: '+260 966 897076',
}

export const whatsappLink = (text?: string) =>
  `https://wa.me/${whatsapp.number}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export const mailLink = (subject: string, body?: string) =>
  `mailto:${emails[0]}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`

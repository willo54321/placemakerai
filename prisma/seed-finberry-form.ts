/**
 * Creates the Finberry North West public consultation feedback form (the
 * Church Commissioners' outline application for ~230 homes, Ashford) as a
 * Placemaker feedback form, question for question from the paper form.
 *
 * Finds the project by id (FINBERRY_PROJECT_ID) or by name ("Finberry"), and
 * skips if the project already has a form with this name. Pass --create to
 * create a local project when none exists (dev only).
 *
 *   npx tsx prisma/seed-finberry-form.ts [--create]
 *   FINBERRY_PROJECT_ID=... npm run seed:finberry:prod
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import type { FormFieldDef } from '../src/lib/form-fields'

const prisma = new PrismaClient()

export const FORM_NAME = 'Finberry North West public consultation'

const AGREE = ['Support', 'Neither support nor oppose', 'Oppose', 'Not sure']

export const FINBERRY_FIELDS: FormFieldDef[] = [
  {
    id: 'intro', type: 'heading', label: '',
    description:
      'The Church Commissioners for England is preparing an outline planning application for approximately 230 new homes, including 30% affordable housing, on land at Finberry North West.\n\n' +
      'Thank you for viewing our proposals. Your feedback will help inform the application and will be summarised in a Statement of Community Involvement submitted to Ashford Borough Council.\n\n' +
      'About the outline application\n' +
      'The outline application will seek approval for the principle of development and access arrangements. The masterplan is illustrative; detailed layout, appearance, landscaping and scale would be considered through subsequent reserved matters applications.\n\n' +
      'How we will use your information\n' +
      'Your feedback and any personal information you choose to provide will be used to understand local views, inform the proposals and prepare the planning application. Feedback may be shared with the Church Commissioners and their appointed project advisers. Consultation findings will be summarised in a Statement of Community Involvement submitted to Ashford Borough Council and made publicly available. We will remove identifying personal details from comments included in that report.\n\n' +
      'Please return your feedback by Friday 6 November 2026.',
  },
  {
    id: 'q1_informative', type: 'radio', label: '1. How informative did you find the consultation materials?',
    options: ['Very informative', 'Quite informative', 'Neither informative nor uninformative', 'Not very informative', 'Not at all informative', 'Not sure'],
  },
  { id: 'q1_clearer', type: 'textarea', label: 'Was there any information you would have liked us to explain more clearly?' },
  {
    id: 'q2_overall', type: 'radio',
    label: '2. What is your overall view of the proposals for approximately 230 new homes on the Church Commissioners’ land at Finberry North West?',
    options: ['Strongly support', 'Support', 'Neither support nor oppose', 'Oppose', 'Strongly oppose', 'Not sure'],
  },
  { id: 'q2_explain', type: 'textarea', label: 'Please explain your answer, including any views on the number of homes proposed.' },
  {
    id: 'q3_homes', type: 'checkbox', label: '3. What types of homes do you think are most needed locally?',
    description: 'The detailed mix of homes will be developed later, taking account of housing needs, policy and market demand. Please tick all that apply.',
    options: [
      'One- and two-bedroom homes', 'Three-bedroom homes', 'Four-bedroom or larger homes', 'Affordable homes to rent',
      'Affordable home ownership, such as shared ownership', 'Homes suitable for older people or people wishing to downsize',
      'Accessible homes for people with disabilities or reduced mobility', 'Not sure', 'Other – please specify',
    ],
    specify: ['Other – please specify'],
  },
  { id: 'q3_needs', type: 'textarea', label: 'Please tell us more about any local housing needs we should consider.' },
  {
    id: 'q4_uses', type: 'checkbox', label: '4. What mix of uses would you prefer to see on the site?',
    description:
      'The site allocation includes housing and 0.7 hectares of employment land. Our preferred masterplan focuses on new homes without employment space. We are assessing whether employment development would be suitable and commercially deliverable here, taking account of local demand and alternative provision, to inform ongoing discussions with Ashford Borough Council.\n\n' +
      'Which uses would you like to see included? Please tick all that apply.',
    options: [
      'New homes, including affordable housing', 'Small-scale light-industrial or workshop space for local businesses',
      'Offices or flexible workspace', 'Shops, cafés or other local services', 'Community facilities or meeting space',
      'Not sure', 'Other – please specify',
    ],
    specify: ['Other – please specify'],
  },
  {
    id: 'q4_explain', type: 'textarea',
    label: 'Please explain your preferences, including any particular local needs, business demand or concerns we should consider. If you selected several uses, please tell us which you consider most important.',
    description: 'These choices seek your views and do not represent commitments to provide particular uses. Shops, services and community facilities are also planned elsewhere within Finberry.',
  },
  {
    id: 'q5_access', type: 'textarea',
    label: '5. Do you have any comments on the proposed access arrangements from Bullfinch Avenue and the Finberry Primary School access road, including any local traffic, pedestrian or road-safety issues we should consider?',
  },
  {
    id: 'q6_routes', type: 'textarea',
    label: '6. Where do you currently walk, wheel or cycle locally, and how could the proposed routes connect most effectively with existing Finberry?',
    description: 'Please identify any important destinations, missing links or barriers to getting around.',
  },
  {
    id: 'q7_prow', type: 'textarea',
    label: '7. Do you have any comments on the option to re-route public right of way AW296 within a green corridor?',
    description: 'Please refer to the access and movement plan or ask a member of the project team if you would like help identifying the route.',
  },
  {
    id: 'q8_masterplan', type: 'textarea', label: '8. What are your views on the emerging masterplan?',
    description: 'We welcome comments on the arrangement of homes, streets and green spaces, the proposed lower densities towards the countryside, and how the development could fit with existing homes. Please identify particular locations on the plan where possible.',
  },
  {
    id: 'q9_green', type: 'matrix', label: '9. What are your views on the proposed green and open spaces?',
    description: 'Please select one response for each.',
    rows: [
      'Connected open spaces linking with surrounding Green Corridors',
      'A green buffer adjoining the countryside',
      'A new equipped children’s play area on the green spine',
      'Drainage basins within the open spaces',
      'Measures to enhance habitats and deliver at least 10% biodiversity net gain',
    ],
    options: AGREE,
  },
  {
    id: 'q9_spaces', type: 'textarea',
    label: 'How could these spaces best serve existing and future residents?',
    description: 'Please include any comments on their location, accessibility, play opportunities or future maintenance.',
  },
  {
    id: 'q10_environment', type: 'textarea',
    label: '10. Is there any local information about flooding, drainage, ecology or wildlife that you would like the project team to consider?',
    description: 'Please identify locations and describe your observations where possible.',
  },
  {
    id: 'q11_community', type: 'textarea',
    label: '11. What should we consider to help the development become part of the wider Finberry community?',
    description:
      'The proposals would share the existing and planned facilities across Finberry, including the planned local centre and community facilities.\n\n' +
      'Please share any views on connections to these facilities, their accessibility or capacity, and other local infrastructure needs.',
  },
  {
    id: 'q12_lessons', type: 'textarea',
    label: '12. What lessons from recent development in Finberry or the surrounding area should inform these proposals?',
    description: 'Please tell us what has worked well and what could be improved.',
  },
  { id: 'q13_further', type: 'textarea', label: '13. Do you have any further comments, concerns or suggestions about the proposals?' },
  { id: 'about_you', type: 'heading', label: 'About you — optional' },
  {
    id: 'q14_connection', type: 'checkbox', label: '14. What is your connection to the area?',
    description: 'Please tick all that apply.',
    options: [
      'I live in Finberry', 'I live elsewhere nearby', 'I work in the area', 'I own or run a business in the area',
      'I study in the area', 'I am a parent or carer of a pupil at Finberry Primary School', 'I regularly visit the area',
      'Prefer not to say', 'I represent a local organisation – please specify', 'Other – please specify',
    ],
    specify: ['I represent a local organisation – please specify', 'Other – please specify'],
  },
  { id: 'q15_postcode', type: 'text', label: '15. What is your home postcode?' },
  {
    id: 'q16_age', type: 'radio', label: '16. What is your age group?',
    options: ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65–74', '75 or over', 'Prefer not to say'],
  },
  { id: 'keep_in_touch', type: 'heading', label: 'Keep in touch — optional' },
  { id: 'updates', type: 'subscribe', label: 'Updates', options: ['I would like to receive updates about the Finberry North West proposals.'] },
  { id: 'name', type: 'text', label: 'Name' },
  { id: 'email', type: 'email', label: 'Email' },
]

async function main() {
  const create = process.argv.includes('--create')
  const wantedId = process.env.FINBERRY_PROJECT_ID

  let project = wantedId
    ? await prisma.project.findUnique({ where: { id: wantedId } })
    : await prisma.project.findFirst({ where: { name: { contains: 'Finberry', mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } })

  if (!project && create) {
    project = await prisma.project.create({
      data: { id: 'finberry-north-west', name: 'Finberry North West', embedEnabled: true, emailLocalPart: 'finberry' },
    })
    console.log(`Created local project ${project.id}`)
  }
  if (!project) {
    console.error(wantedId ? `No project with id ${wantedId}` : 'No project named Finberry found (pass --create locally, or set FINBERRY_PROJECT_ID)')
    process.exit(1)
  }

  const existing = await prisma.feedbackForm.findFirst({ where: { projectId: project.id, name: FORM_NAME } })
  if (existing) {
    console.log(`Form already exists on "${project.name}": ${existing.id} — nothing to do`)
    return
  }
  const form = await prisma.feedbackForm.create({
    data: { projectId: project.id, name: FORM_NAME, active: true, fields: FINBERRY_FIELDS as object[] },
  })
  console.log(`Created "${FORM_NAME}" on "${project.name}" (${project.id}): form ${form.id}`)
  console.log(`Public link: ${process.env.NEXTAUTH_URL ?? 'http://localhost:3002'}/forms/${form.id}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

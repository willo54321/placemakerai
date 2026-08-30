export interface CaseStudy {
  slug: string;
  client: string;
  logo: string;
  headline: string;
  title: string;
  project: string;
  location: string;
  sector: string;
  brief: {
    summary: string;
    challenges: string[];
  };
  solution: {
    summary: string;
    tools: string[];
    detail: string;
  };
  results?: { label: string; value: string }[];
  quote?: {
    text: string;
    author: string;
    role: string;
  };
  image: string;
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'vistry-ford',
    client: 'Vistry Homes',
    logo: '/logos/vistry-logo-dark.svg',
    headline: 'Interactive consultation tools helped residents understand a complex 1,500+ home masterplan.',
    title: 'Interactive consultation tools helped residents understand a complex 1,500+ home masterplan',
    project: 'Ford Airfield Redevelopment',
    location: 'Ford, West Sussex',
    sector: 'Residential Development',
    brief: {
      summary:
        'Vistry Homes were consulting on a large and complex proposal for over 1,500 homes on a former airfield site. The scale and complexity of the masterplan made it challenging for residents to fully understand the proposals through traditional consultation methods.',
      challenges: [
        'Very large and complex proposal for over 1,500 homes',
        'Masterplan difficult for residents to interpret without guidance',
        'Need for higher quality, more informed feedback',
        'Traditional consultation methods not providing adequate understanding',
      ],
    },
    solution: {
      summary:
        'We built a consultation website featuring an interactive feedback map that allowed residents to explore the proposals and provide location-specific comments.',
      tools: [
        'Interactive feedback map',
        'Location-pinned comments',
        'Mobile-optimised consultation website',
        'Feedback reporting and export',
      ],
      detail:
        'The interactive map allowed residents to explore the masterplan at their own pace and leave feedback pinned to specific locations. This promoted better understanding of the complex proposals and resulted in higher quality feedback that was more useful for the project team.',
    },
    image: '/case-studies/ford-airfield.jpg',
  },
  {
    slug: 'royal-mail-brighton',
    client: 'Royal Mail',
    logo: '/logos/royal-mail.png',
    headline: 'Digital engagement platform enabled residents to report construction issues directly via an interactive map.',
    title: 'Digital engagement platform for construction phase community relations',
    project: 'Brighton Delivery Office Construction',
    location: 'Brighton, East Sussex',
    sector: 'Construction & Infrastructure',
    brief: {
      summary:
        'Construction projects in residential areas generate ongoing concerns from local communities about noise, dust, and traffic disruption. Traditional feedback methods such as email and phone lack geographic precision, making it difficult for site teams to investigate issues effectively and demonstrate responsive management.',
      challenges: [
        'Community concerns about noise, dust, and traffic disruption',
        'Traditional feedback methods lack geographic precision',
        'Site teams struggle to investigate issues effectively',
        'Need to demonstrate responsive community management',
      ],
    },
    solution: {
      summary:
        'We created a branded construction update portal with an integrated geospatial feedback system.',
      tools: [
        'Interactive issue reporting map',
        'Centralised communications hub',
        'Mailing list integration',
        'Project team directory',
      ],
      detail:
        'Residents can click on a map to report concerns at precise locations, categorising issues by type. This gives the site team actionable data to investigate and respond quickly. Monthly progress updates, downloadable documents, and FAQs provide a single destination for project information, reducing enquiries and keeping the community informed. Residents can subscribe to receive updates directly, maintaining engagement throughout the construction period.',
    },
    image: '/case-studies/royal-mail-brighton.png',
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((cs) => cs.slug === slug);
}

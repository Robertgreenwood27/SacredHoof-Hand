export type LegalBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: readonly string[];
    }
  | {
      type: "contact";
      name: string;
      email: string;
    };

export type LegalSection = {
  number: string;
  id: string;
  title: string;
  blocks: readonly LegalBlock[];
};

export type LegalDocument = {
  title: string;
  shortTitle: string;
  eyebrow: string;
  summary: string;
  version: string;
  effectiveDate: string;
  readingNotice?: string;
  introduction: readonly string[];
  sections: readonly LegalSection[];
  closing?: readonly string[];
};

export const LEGAL_CONTACT_EMAIL = "sacredhoofandhand@gmail.com";
export const TERMS_VERSION = "2026-07-21";
export const TERMS_EFFECTIVE_DATE = "2026-07-21";
export const WAIVER_VERSION = "2026-07-21";
export const WAIVER_EFFECTIVE_DATE = "2026-07-21";
export const TERMS_EFFECTIVE_DATE_LABEL = "July 21, 2026";
export const WAIVER_EFFECTIVE_DATE_LABEL = "July 21, 2026";

export const TERMS_OF_SERVICE = {
  title: "Terms of Service",
  shortTitle: "Terms",
  eyebrow: "Care, clarity, and mutual respect",
  summary:
    "These terms explain the scope of our services, your responsibilities, and the policies that support a safe experience.",
  version: TERMS_VERSION,
  effectiveDate: TERMS_EFFECTIVE_DATE_LABEL,
  readingNotice:
    "Please read these Terms before booking. By booking a session, purchasing a service, or using this website, you agree to them.",
  introduction: [
    'Welcome to Sacred Hoof & Hand. These Terms of Service ("Terms") govern your use of our website, services, and products. By booking a session, purchasing a service, or using this website, you agree to these Terms.',
  ],
  sections: [
    {
      number: "1",
      id: "our-services",
      title: "Our Services",
      blocks: [
        {
          type: "paragraph",
          text: "Sacred Hoof & Hand offers holistic wellness services, which may include:",
        },
        {
          type: "list",
          items: [
            "Reiki energy healing",
            "Equine-assisted Reiki sessions",
            "Guided meditation",
            "Tarot and oracle card readings",
            "Spiritual coaching and educational workshops",
          ],
        },
        {
          type: "paragraph",
          text: "These services are intended to support relaxation, personal growth, and spiritual well-being.",
        },
      ],
    },
    {
      number: "2",
      id: "not-medical-care",
      title: "Not Medical or Mental Health Care",
      blocks: [
        {
          type: "paragraph",
          text: "Sacred Hoof & Hand does not provide medical, psychological, psychiatric, or veterinary services.",
        },
        {
          type: "paragraph",
          text: "Our services are not intended to diagnose, treat, cure, or prevent any disease or medical condition. Energy healing and tarot readings are complementary wellness practices and should never replace care from a licensed medical or mental health professional.",
        },
        {
          type: "paragraph",
          text: "If you are experiencing a medical emergency, please contact emergency services immediately (911).",
        },
      ],
    },
    {
      number: "3",
      id: "client-responsibility",
      title: "Client Responsibility",
      blocks: [
        {
          type: "paragraph",
          text: "By participating in our services, you acknowledge that:",
        },
        {
          type: "list",
          items: [
            "You are responsible for your own physical, emotional, and mental well-being.",
            "Please disclose any medical conditions, injuries, allergies, or mobility limitations that may affect your participation.",
            "You participate voluntarily and may stop a session at any time.",
          ],
        },
      ],
    },
    {
      number: "4",
      id: "equine-assisted-sessions",
      title: "Equine-Assisted Sessions",
      blocks: [
        {
          type: "paragraph",
          text: "Working around horses involves inherent risks.",
        },
        {
          type: "paragraph",
          text: "By participating in an equine-assisted session, you acknowledge that:",
        },
        {
          type: "list",
          items: [
            "Horses are living animals whose behavior can be unpredictable.",
            "You agree to follow all safety instructions given by Sacred Hoof & Hand.",
            "Closed-toe shoes are required.",
            "You will not approach, feed, or handle any horse unless instructed.",
            "Sacred Hoof & Hand reserves the right to end a session if safety becomes a concern.",
          ],
        },
        {
          type: "paragraph",
          text: "A separate Liability Waiver and Assumption of Risk Agreement must be signed before participating in any equine-assisted services.",
        },
      ],
    },
    {
      number: "5",
      id: "scheduling-and-cancellations",
      title: "Scheduling and Cancellations",
      blocks: [
        {
          type: "list",
          items: [
            "Appointments must be scheduled in advance.",
            "Cancellations made at least 72 hours before your appointment may be rescheduled without penalty.",
            "Cancellations made with less than 24 hours' notice may be subject to fees.",
            "No-shows will be charged the full session fee.",
            "Sacred Hoof & Hand reserves the right to reschedule appointments due to weather, horse welfare, illness, or unforeseen circumstances.",
          ],
        },
      ],
    },
    {
      number: "6",
      id: "payments-and-refunds",
      title: "Payments and Refunds",
      blocks: [
        {
          type: "paragraph",
          text: "Payment is due at the time of booking unless otherwise agreed.",
        },
        {
          type: "paragraph",
          text: "Because time is reserved specifically for each client:",
        },
        {
          type: "list",
          items: [
            "Services already provided are non-refundable.",
            "Refunds for unused services or packages are provided at the sole discretion of Sacred Hoof & Hand.",
          ],
        },
      ],
    },
    {
      number: "7",
      id: "confidentiality",
      title: "Confidentiality",
      blocks: [
        {
          type: "paragraph",
          text: "Your privacy is important.",
        },
        {
          type: "paragraph",
          text: "Information shared during sessions will be kept confidential except:",
        },
        {
          type: "list",
          items: [
            "when required by law,",
            "when necessary to prevent imminent harm,",
            "or when you provide written permission to share information.",
          ],
        },
      ],
    },
    {
      number: "8",
      id: "intellectual-property",
      title: "Intellectual Property",
      blocks: [
        {
          type: "paragraph",
          text: "All website content, written materials, logos, graphics, photographs, and educational resources are the property of Sacred Hoof & Hand and may not be copied, reproduced, or distributed without written permission.",
        },
      ],
    },
    {
      number: "9",
      id: "limitation-of-liability",
      title: "Limitation of Liability",
      blocks: [
        {
          type: "paragraph",
          text: "To the fullest extent permitted by law, Sacred Hoof & Hand and its owners, employees, volunteers, contractors, and partners shall not be liable for any injury, loss, damage, or claim arising from participation in our services.",
        },
        {
          type: "paragraph",
          text: "By participating, you acknowledge that you accept full responsibility for your decisions and actions before, during, and after your sessions.",
        },
      ],
    },
    {
      number: "10",
      id: "right-to-refuse-service",
      title: "Right to Refuse Service",
      blocks: [
        {
          type: "paragraph",
          text: "Sacred Hoof & Hand reserves the right to refuse or discontinue services if a client's behavior is unsafe, abusive, inappropriate, or places the horses, staff, volunteers, or other participants at risk.",
        },
      ],
    },
    {
      number: "11",
      id: "changes-to-terms",
      title: "Changes to These Terms",
      blocks: [
        {
          type: "paragraph",
          text: "These Terms may be updated from time to time. Continued use of our services after changes are posted constitutes acceptance of the revised Terms.",
        },
      ],
    },
    {
      number: "12",
      id: "contact",
      title: "Contact",
      blocks: [
        {
          type: "paragraph",
          text: "If you have questions regarding these Terms of Service, please contact:",
        },
        {
          type: "contact",
          name: "Sacred Hoof & Hand",
          email: LEGAL_CONTACT_EMAIL,
        },
      ],
    },
  ],
  closing: [
    "Thank you for allowing Sacred Hoof & Hand to be part of your healing journey. We are honored to provide a safe, compassionate space where people and horses can come together for connection, healing, and personal growth.",
  ],
} as const satisfies LegalDocument;

// IMPORTANT: This general waiver draft is intentionally jurisdiction-neutral.
// It should be reviewed by a qualified attorney before production use, especially
// for local requirements concerning equine activities, minors, releases, and
// electronic signatures.
export const LIABILITY_WAIVER = {
  title: "Liability Waiver and Assumption of Risk Agreement",
  shortTitle: "Liability Waiver",
  eyebrow: "Participation, safety, and informed consent",
  summary:
    "This agreement describes the risks of holistic wellness and equine-assisted activities and the responsibilities accepted by each participant.",
  version: WAIVER_VERSION,
  effectiveDate: WAIVER_EFFECTIVE_DATE_LABEL,
  readingNotice:
    "Please read this agreement carefully. It affects legal rights. Viewing this page does not sign the agreement; you will be asked to acknowledge and sign it as part of the booking process.",
  introduction: [
    'This Liability Waiver and Assumption of Risk Agreement ("Agreement") is between Sacred Hoof & Hand and the person receiving or participating in services ("Participant"). If the Participant is under the age of legal majority, a parent or legal guardian must complete any required consent and signature.',
    "Participation is voluntary. Please ask questions before signing and do not sign this Agreement if you do not understand it.",
  ],
  sections: [
    {
      number: "1",
      id: "covered-activities",
      title: "Covered Activities",
      blocks: [
        {
          type: "paragraph",
          text: "This Agreement applies to services and activities offered or facilitated by Sacred Hoof & Hand, whether in person, virtually, on private property, or at another location. Covered activities may include Reiki energy healing, equine-assisted Reiki, guided meditation, tarot or oracle card readings, spiritual coaching, educational workshops, and reasonable activities connected with arriving, leaving, observing, or participating.",
        },
      ],
    },
    {
      number: "2",
      id: "not-health-care",
      title: "Not Medical, Mental Health, or Veterinary Care",
      blocks: [
        {
          type: "paragraph",
          text: "Sacred Hoof & Hand does not provide medical, psychological, psychiatric, or veterinary diagnosis or treatment. Its services are complementary wellness practices and are not a substitute for care from an appropriately licensed professional.",
        },
        {
          type: "paragraph",
          text: "The Participant is responsible for deciding whether participation is appropriate and for consulting a qualified professional when needed.",
        },
      ],
    },
    {
      number: "3",
      id: "general-risks",
      title: "General Wellness and Environmental Risks",
      blocks: [
        {
          type: "paragraph",
          text: "The Participant understands that wellness activities and the locations where they occur may involve risks. These may include emotional discomfort, fatigue, dizziness, physical discomfort, slips, trips, falls, contact with natural surfaces or equipment, exposure to weather, insects, plants, dust, allergens, other people, or other conditions that cannot always be anticipated or controlled.",
        },
        {
          type: "paragraph",
          text: "Some risks may result from the Participant's health, choices, conduct, or failure to follow instructions; from the conduct of other people; or from conditions at the activity location.",
        },
      ],
    },
    {
      number: "4",
      id: "equine-risks",
      title: "Equine-Assisted Activity Risks",
      blocks: [
        {
          type: "paragraph",
          text: "Horses are large, powerful living animals with independent behavior. Even a calm or well-trained horse may react suddenly and without warning to sounds, movement, people, animals, objects, weather, pain, fear, or other stimuli.",
        },
        {
          type: "paragraph",
          text: "Risks associated with being near or working with horses may include:",
        },
        {
          type: "list",
          items: [
            "being kicked, bitten, stepped on, struck, pushed, pinned, dragged, or knocked down;",
            "a horse bucking, rearing, bolting, stumbling, falling, colliding, or moving unexpectedly;",
            "contact with fences, gates, tack, tools, vehicles, structures, other animals, or other participants;",
            "uneven or slippery ground, holes, mud, dust, manure, insects, weather, and other farm or outdoor conditions;",
            "allergic reactions or exposure to hay, feed, animals, plants, or environmental substances; and",
            "property damage, serious bodily injury, permanent disability, or death.",
          ],
        },
        {
          type: "paragraph",
          text: "Not every risk can be listed, and the absence of a risk from this list does not mean that the risk does not exist.",
        },
      ],
    },
    {
      number: "5",
      id: "assumption-of-risk",
      title: "Voluntary Assumption of Risk",
      blocks: [
        {
          type: "paragraph",
          text: "The Participant knowingly and voluntarily chooses to participate and accepts the inherent and other ordinary risks of the covered activities, whether known or unknown, to the fullest extent permitted by applicable law.",
        },
        {
          type: "paragraph",
          text: "The Participant understands that participation may involve serious injury, illness, emotional distress, property damage, permanent disability, or death, and accepts responsibility for deciding whether to begin or continue an activity.",
        },
      ],
    },
    {
      number: "6",
      id: "participant-responsibilities",
      title: "Participant Responsibilities and Safety Rules",
      blocks: [
        {
          type: "paragraph",
          text: "The Participant agrees to:",
        },
        {
          type: "list",
          items: [
            "provide accurate information about medical conditions, injuries, allergies, medications, mobility limitations, fears, or other circumstances that may affect safe participation;",
            "follow all instructions, boundaries, posted rules, and safety directions from Sacred Hoof & Hand and activity staff;",
            "wear closed-toe shoes for equine-assisted activities and use any safety equipment required for the activity;",
            "not approach, touch, feed, lead, ride, or otherwise handle a horse unless specifically instructed and supervised;",
            "remain alert and refrain from participating while impaired by alcohol, cannabis, illegal drugs, or any substance that makes participation unsafe;",
            "act respectfully and avoid behavior that may endanger the Participant, horses, staff, volunteers, or other people; and",
            "stop participating and promptly tell Sacred Hoof & Hand if the Participant feels unsafe, unwell, overwhelmed, or unable to follow instructions.",
          ],
        },
        {
          type: "paragraph",
          text: "Sacred Hoof & Hand may modify, pause, or end an activity at any time when safety, horse welfare, weather, or other circumstances make doing so appropriate.",
        },
      ],
    },
    {
      number: "7",
      id: "release-of-liability",
      title: "Release of Liability",
      blocks: [
        {
          type: "paragraph",
          text: "To the fullest extent permitted by applicable law, the Participant releases and agrees not to bring a claim against Sacred Hoof & Hand and its owners, employees, contractors, volunteers, agents, affiliates, participating property owners, and horse owners or handlers for injury, loss, death, or property damage arising from the inherent risks of the covered activities or from ordinary negligence.",
        },
        {
          type: "paragraph",
          text: "This release does not apply to gross negligence, reckless or willful misconduct, intentional harm, or any right or liability that applicable law does not allow a person to waive.",
        },
      ],
    },
    {
      number: "8",
      id: "emergency-care",
      title: "Emergency Care and Related Costs",
      blocks: [
        {
          type: "paragraph",
          text: "If the Participant cannot make or communicate a decision during an emergency, the Participant authorizes Sacred Hoof & Hand to contact emergency services and to provide reasonably available information to responders. Sacred Hoof & Hand does not promise or undertake to provide medical care.",
        },
        {
          type: "paragraph",
          text: "The Participant is responsible for medical, transportation, insurance, and other costs arising from the Participant's care, except to the extent applicable law requires otherwise.",
        },
      ],
    },
    {
      number: "9",
      id: "personal-property",
      title: "Personal Property",
      blocks: [
        {
          type: "paragraph",
          text: "The Participant is responsible for personal belongings brought to a session or activity. Sacred Hoof & Hand is not responsible for loss, theft, or damage except to the extent caused by conduct for which liability cannot lawfully be limited.",
        },
      ],
    },
    {
      number: "10",
      id: "participant-conduct",
      title: "Responsibility for Participant Conduct",
      blocks: [
        {
          type: "paragraph",
          text: "To the fullest extent permitted by applicable law, the Participant agrees to be responsible for claims, losses, or reasonable costs caused by the Participant's own intentional misconduct, negligent acts, or material failure to follow safety instructions. This provision does not require the Participant to be responsible for another person's gross negligence, reckless or willful misconduct, or intentional harm.",
        },
      ],
    },
    {
      number: "11",
      id: "minors",
      title: "Participants Under the Age of Legal Majority",
      blocks: [
        {
          type: "paragraph",
          text: "A minor may not sign this Agreement alone. A parent or legal guardian must provide the required consent and may be asked to sign an additional parent or guardian agreement. Sacred Hoof & Hand may decline or postpone participation when the appropriate adult consent is not available.",
        },
      ],
    },
    {
      number: "12",
      id: "severability",
      title: "Severability and Applicable Law",
      blocks: [
        {
          type: "paragraph",
          text: "This Agreement is intended to be interpreted under the law that applies where the covered activity occurs. If any provision is found unenforceable, the remaining provisions will continue to the extent permitted by law, and the affected provision will be limited only as much as necessary to make it enforceable.",
        },
      ],
    },
    {
      number: "13",
      id: "electronic-signature",
      title: "Acknowledgment and Electronic Signature",
      blocks: [
        {
          type: "paragraph",
          text: "By signing electronically, the Participant confirms that the Participant has read this Agreement, understands that it affects legal rights, has had an opportunity to ask questions, and signs freely and voluntarily. The Participant agrees that an electronic signature and related electronic records may be used and will have the same effect as a handwritten signature to the extent permitted by applicable law.",
        },
        {
          type: "paragraph",
          text: "The Participant consents to receive the booking agreements, confirmation, schedule-change notices, and reminders electronically at the email address provided. The Participant confirms access to a current web browser and email account and the ability to save or print these records.",
        },
        {
          type: "paragraph",
          text: "The Participant may request a paper copy, update the email address used for records, or withdraw consent for future electronic records by contacting Sacred Hoof & Hand at no charge. Withdrawal does not affect the validity of records already provided or signed and may require completing future booking arrangements offline.",
        },
      ],
    },
    {
      number: "14",
      id: "waiver-contact",
      title: "Questions",
      blocks: [
        {
          type: "paragraph",
          text: "If you have questions about this Agreement before signing, please contact:",
        },
        {
          type: "contact",
          name: "Sacred Hoof & Hand",
          email: LEGAL_CONTACT_EMAIL,
        },
      ],
    },
  ],
} as const satisfies LegalDocument;

function toPlainText(document: LegalDocument): string {
  const lines: string[] = [
    `Sacred Hoof & Hand - ${document.title}`,
    `Effective Date: ${document.effectiveDate}`,
    "",
    ...document.introduction,
  ];

  for (const section of document.sections) {
    lines.push("", `${section.number}. ${section.title}`);

    for (const block of section.blocks) {
      if (block.type === "paragraph") {
        lines.push(block.text);
      } else if (block.type === "list") {
        lines.push(...block.items.map((item) => `- ${item}`));
      } else {
        lines.push(block.name, `Email: ${block.email}`);
      }
    }
  }

  if (document.closing) {
    lines.push("", ...document.closing);
  }

  return lines.join("\n");
}

/**
 * Canonical plain-text snapshots for consent records and content hashing.
 * Keep consumers tied to the matching version constant above.
 */
export const TERMS_TEXT = toPlainText(TERMS_OF_SERVICE);
export const WAIVER_TEXT = toPlainText(LIABILITY_WAIVER);

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Is U-R-LIVE free to use?',
    answer:
      'Yes. Random one-to-one video chat is free and does not require an account. Pro is an optional subscription that unlocks gender, country and language filters plus priority queue placement.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. You can start as an anonymous guest. An optional Google sign-in lets you keep preferences and a Pro subscription across devices.',
  },
  {
    question: 'Are my video calls recorded?',
    answer:
      'No. Video and audio travel directly between the two browsers over encrypted WebRTC (DTLS/SRTP). U-R-LIVE does not record, store or monitor call content.',
  },
  {
    question: 'How do you keep the platform 18+?',
    answer:
      'Every visitor must confirm they are 18 or older before entering a live session. Underage reports are reviewed urgently, and confirmed violations lead to immediate bans and referrals where required.',
  },
  {
    question: 'What happens when I report someone?',
    answer:
      'The report is sent to the safety team with the category you select. The other person is blocked from matching with you again, and the report is reviewed for enforcement.',
  },
  {
    question: 'Can I cancel Pro at any time?',
    answer:
      'Yes. Cancelling stops future renewals and your Pro features stay active until the end of the period you already paid for.',
  },
];

/**
 * User-Facing Message Templates for StyleScent AI.
 *
 * What: Centralized repository of all fixed copy, prompts, clarification questions,
 * and boundary refusals.
 * Why: Allows the product and styling team to tune tone, polish wording, and audit safety
 * copy without altering core agent or tool logic.
 */

export const MESSAGES = {
  greeting_help: `👋 **Hello! I'm StyleScent**, your AI personal stylist and fragrance consultant.

I can help you build complete outfits with harmonised palettes and pair them with curated fragrances grounded in colour theory and olfactory notes.

Here are a few things you can ask me:
1. **Full Look:** *"What should I wear to a college fest evening? I like dark colours and no vanilla."*
2. **Garment Pairing:** *"What pants and shoes should I pair with a maroon striped shirt?"*
3. **Fragrance Pick:** *"Suggest a fresh, long-lasting summer perfume for the office under ₹3,000."*

What occasion or garment are we styling today?`,

  clarifications: {
    occasion: 'Which occasion are you dressing for? (e.g. college fest, date night, office, wedding, casual, interview)',
    anchor: 'Could you tell me the anchor piece or colour you would like to pair around? (e.g. "maroon shirt" or "olive green")',
    conflict: (type, garmentFormality, occasion, occasionFormality) =>
      `Your ${type} is ${garmentFormality}, which clashes with the ${occasionFormality} dress code for a ${occasion}. Would you like to proceed with this item anyway, or should I suggest an outfit suited to the occasion?`,
    imageNotSupported:
      "I can't analyse photos yet. Please tell me your garment's type, colour, and pattern in text (e.g. 'navy blue striped shirt').",
  },

  refusals: {
    out_of_scope:
      "I am StyleScent, a personal styling agent specialised in outfit colour palettes, pattern matching, and fragrance pairings. I can't help with general tasks outside fashion and fragrance, but I'd be delighted to help you style an outfit! What occasion are you dressing for?",
    guarantee:
      "While I cannot guarantee personal or interview outcomes, I can help you put together a refined, occasion-appropriate look and scent to help you feel confident.",
    live_price_stock:
      "I don't have access to live store inventories or real-time retail pricing, but I can recommend pieces and fragrances across budget, mid-range, and premium tiers.",
    medical_allergy:
      "I cannot provide medical or dermatological allergy advice. If you have skin sensitivities, please consult a healthcare professional. I can, however, filter out specific fragrance notes you wish to avoid.",
  },

  notices: {
    limitsPrefix:
      '*(Note: I cannot guarantee external outcomes, check live retail stock, or give medical advice, but here is your curated styling plan:)*\n\n',
    noCloseMatch:
      'No close fragrance matches were found in our curated database for your exact criteria. Consider broadening your budget tier or relaxing specific note constraints.',
    llmFailureApology:
      '*(I experienced a temporary hitch generating custom prose, so here is your styling breakdown directly from our colour and fragrance engines:)*\n\n',
  },
};

// Example lead scoring logic
function calculateLeadScore(lead) {
  let score = 0;

  // +10 for having email, +5 for phone, +2 for name
  if (lead.email) score += 10;
  if (lead.phone) score += 5;
  if (lead.name) score += 2;

  // +5 if source is referral
  if (lead.source && lead.source.toLowerCase() === 'referral') score += 5;

  // +1 for each interaction
  if (Array.isArray(lead.interactions)) score += lead.interactions.length;

  return score;
}

module.exports = { calculateLeadScore };

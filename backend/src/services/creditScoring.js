// Rule-based credit scoring engine (0–100 points)

function scoreCibil(cibil) {
  if (cibil >= 750) return 30;
  if (cibil >= 700) return 22;
  if (cibil >= 650) return 15;
  if (cibil >= 600) return 8;
  return 3;
}

function scoreDti(dtiPercent) {
  if (dtiPercent < 30) return 25;
  if (dtiPercent < 40) return 18;
  if (dtiPercent < 50) return 10;
  return 3;
}

function scoreEmployment(empType) {
  const map = {
    'Salaried': 20,
    'Business': 15,
    'Self-Employed': 12,
    'Retired': 10,
    'Unemployed': 2,
  };
  return map[empType] || 5;
}

function scoreIncome(monthlyIncome) {
  if (monthlyIncome >= 200000) return 25;
  if (monthlyIncome >= 100000) return 20;
  if (monthlyIncome >= 50000) return 15;
  if (monthlyIncome >= 25000) return 8;
  return 3;
}

function getRiskBand(total) {
  if (total >= 80) return 'Low';
  if (total >= 65) return 'Medium';
  if (total >= 45) return 'High';
  return 'Very High';
}

function getRecommendation(total) {
  if (total >= 80) return 'Approve';
  if (total >= 45) return 'Manual Review';
  return 'Decline';
}

function calculateScore({ cibilScore, monthlyIncome, monthlyExpenses, existingEmi, loanAmount, tenureMonths, employmentType, interestRate }) {
  const r = (interestRate / 12) / 100;
  const proposedEmi = r > 0
    ? loanAmount * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1)
    : loanAmount / tenureMonths;

  const totalObligations = (existingEmi || 0) + proposedEmi;
  const dtiRatio = monthlyIncome > 0 ? (totalObligations / monthlyIncome) * 100 : 100;

  const cibilPts = scoreCibil(cibilScore || 0);
  const dtiPts = scoreDti(dtiRatio);
  const empPts = scoreEmployment(employmentType);
  const incPts = scoreIncome(monthlyIncome || 0);
  const total = cibilPts + dtiPts + empPts + incPts;

  return {
    cibilScore,
    dtiRatio: parseFloat(dtiRatio.toFixed(2)),
    proposedEmi: parseFloat(proposedEmi.toFixed(2)),
    cibilScorePoints: cibilPts,
    dtiScorePoints: dtiPts,
    employmentScore: empPts,
    incomeScore: incPts,
    totalScore: total,
    riskBand: getRiskBand(total),
    recommendation: getRecommendation(total),
  };
}

module.exports = { calculateScore };

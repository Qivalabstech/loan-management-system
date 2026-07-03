function calculateEMI(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  if (r === 0) return parseFloat((principal / tenureMonths).toFixed(2));
  const emi = principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1);
  return parseFloat(emi.toFixed(2));
}

function buildAmortizationSchedule(principal, annualRate, tenureMonths, firstEmiDate) {
  const r = annualRate / 12 / 100;
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const schedule = [];
  let balance = parseFloat(principal);

  const startDate = firstEmiDate ? new Date(firstEmiDate) : (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return d;
  })();

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = parseFloat((balance * r).toFixed(2));
    const principalComp = parseFloat(Math.min(emi - interest, balance).toFixed(2));
    const newBalance = parseFloat(Math.max(0, balance - principalComp).toFixed(2));

    const dueDate = new Date(startDate);
    dueDate.setMonth(startDate.getMonth() + (i - 1));

    schedule.push({
      emiNumber: i,
      dueDate: dueDate.toISOString().split('T')[0],
      principalComponent: principalComp,
      interestComponent: interest,
      emiAmount: parseFloat(emi.toFixed(2)),
      outstandingAfter: newBalance,
    });

    balance = newBalance;
  }

  const totalPayment = parseFloat((emi * tenureMonths).toFixed(2));
  const totalInterest = parseFloat((totalPayment - principal).toFixed(2));

  return { emi: parseFloat(emi.toFixed(2)), totalInterest, totalPayment, schedule };
}

module.exports = { calculateEMI, buildAmortizationSchedule };

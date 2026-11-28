import java.math.BigInteger;

/** Exact configurable payroll arithmetic, not a jurisdiction-specific tax engine. */
public final class PayrollEngine {
    private static final BigInteger LIMIT = new BigInteger("9007199254740991");
    private static BigInteger amount(String input) {
        if (!input.matches("[0-9]+")) throw new IllegalArgumentException("Nonnegative integer input required");
        BigInteger value = new BigInteger(input);
        if (value.compareTo(LIMIT) > 0) throw new IllegalArgumentException("Supported range exceeded");
        return value;
    }
    public static void main(String[] args) {
        try {
            if (args.length != 5) throw new IllegalArgumentException("Use salaryMinor paidDays scheduledDays allowancesMinor deductionsMinor");
            BigInteger salary=amount(args[0]), paid=amount(args[1]), scheduled=amount(args[2]);
            BigInteger allowances=amount(args[3]), deductions=amount(args[4]);
            if (scheduled.signum()==0 || paid.compareTo(scheduled)>0) throw new IllegalArgumentException("Invalid paid/scheduled days");
            BigInteger gross=salary.multiply(paid).add(scheduled.divide(BigInteger.TWO)).divide(scheduled).add(allowances);
            if (gross.signum()==0 || gross.compareTo(LIMIT)>0 || deductions.compareTo(gross)>0) throw new IllegalArgumentException("Invalid gross or deductions");
            System.out.println("{\"gross\":"+gross+",\"deductions\":"+deductions+",\"net\":"+gross.subtract(deductions)+"}");
        } catch(Exception error) { System.err.println(error.getMessage()); System.exit(1); }
    }
}

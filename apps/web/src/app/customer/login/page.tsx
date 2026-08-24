import { PasswordLogin } from "@/components/PasswordLogin";

export default function CustomerLoginPage() {
  return <PasswordLogin title="Customer Login" redirectTo="/customer/dashboard" />;
}

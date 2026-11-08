import type { Metadata } from "next";
import { SubmitForm } from "@/components/SubmitForm";

export const metadata: Metadata = {
  title: "Add your portfolio",
  description: "Submit your developer portfolio to the FindYourPortfolio directory.",
};

export default function SubmitPage() {
  return (
    <main className="page page-narrow">
      <header className="page-head">
        <p className="eyebrow">Add your portfolio</p>
        <h1>Get your work in front of other developers.</h1>
        <p className="lede">
          Share your portfolio with the community. It appears in the directory right away, gets a live preview,
          and can climb the weekly and yearly rankings.
        </p>
      </header>
      <SubmitForm />
    </main>
  );
}

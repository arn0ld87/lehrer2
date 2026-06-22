import { Card, CardHead, Button } from "../ui";
import { Icon } from "../ui/icon";

/** Feedback-Entwurf — bearbeitbar und nicht als Urteil getarnt. */
export function FeedbackDraft({ text }: { text: string }) {
  return (
    <Card>
      <CardHead
        title="Feedback-Entwurf"
        subtitle="Bearbeitbar und nicht als Urteil getarnt."
        action={<Icon name="message" width={18} height={18} className="text-muted" />}
      />
      <p className="text-xs leading-[1.65] text-[#424A67] m-0">{text}</p>
      <div className="flex gap-2.5 mt-3.5">
        <Button variant="secondary" size="small">
          Bearbeiten
        </Button>
        <Button variant="secondary" size="small">
          Kopieren
        </Button>
      </div>
    </Card>
  );
}
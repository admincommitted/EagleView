import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

// ICEGATE logins live in Settings > ICEGATE Profiles; this master only points there so no password reaches the browser.
export default function IcegateCredentialsNotice() {
  return (
    <Card className="tw:max-w-[640px]">
      <CardHeader>
        <CardTitle>ICEGATE Credentials</CardTitle>
      </CardHeader>
      <CardContent className="tw:flex tw:flex-col tw:items-start tw:gap-2">
        <p className="tw:m-0 tw:text-sm tw:leading-relaxed tw:text-muted-foreground">
          ICEGATE login ID, password and API key are now kept in <b>Settings &gt; ICEGATE Profiles</b> (one profile per
          CHA / login, with a default). Filing, the ICEGATE test and e-mail reading all use those profiles.
        </p>
        <Button asChild variant="default">
          <a href="/settings?tab=icegate">Open ICEGATE Profiles</a>
        </Button>
      </CardContent>
    </Card>
  );
}

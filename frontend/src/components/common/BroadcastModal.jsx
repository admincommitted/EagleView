import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle, Info, Send, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Field, Input, SelectBox, Textarea,
} from '@/components/ui';
import axiosInstance from '@/services/axiosInstance';
import { readTokenUser } from './tokenUser';

const NOTIFICATION_TYPES = {
  info: { label: 'Info', icon: Info, iconClass: 'tw:text-primary', toneClass: 'tw:bg-primary tw:hover:bg-primary/85' },
  success: { label: 'Success', icon: CheckCircle, iconClass: 'tw:text-success', toneClass: 'tw:bg-success tw:hover:bg-success/85' },
  warning: { label: 'Warning', icon: Info, iconClass: 'tw:text-primary', toneClass: 'tw:bg-primary tw:hover:bg-primary/85' },
  error: { label: 'Alert / Error', icon: AlertCircle, iconClass: 'tw:text-destructive', toneClass: 'tw:bg-destructive tw:hover:bg-destructive/85' },
};

const TYPE_OPTIONS = Object.entries(NOTIFICATION_TYPES).map(([value, { label }]) => ({ value, label }));

const LABEL_CLASS = 'tw:text-[13px] tw:font-semibold';

const userLabel = (user) => `👤 ${user.name || user.username || user.email}${user.email ? ` (${user.email})` : ''}`;

export default function BroadcastModal({ isOpen, onClose, onlineUsers }) {
  // only an admin may send to all users (the server refuses it for others), and nobody needs to message himself
  const currentUser = readTokenUser();
  const isAdmin = String(currentUser.role || '').toLowerCase() === 'admin';
  const otherUsers = (onlineUsers || []).filter((user) => String(user.userId) !== String(currentUser.id));
  const [targetUser, setTargetUser] = useState(isAdmin ? 'all' : '');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [isSending, setIsSending] = useState(false);

  const tone = NOTIFICATION_TYPES[type];
  const TypeIcon = tone.icon;

  const targetOptions = [
    ...(isAdmin ? [{ value: 'all', label: `🌐 All users (${otherUsers.length} online now; saved for the others)` }] : []),
    ...otherUsers.map((user) => ({ value: String(user.userId), label: userLabel(user) })),
  ];

  const handleSend = async (event) => {
    event.preventDefault();
    if (!title || !message) {
      toast.error('Title and message are required');
      return;
    }
    if (!targetUser) {
      toast.error(otherUsers.length ? 'Choose who to send to' : 'No other user is online');
      return;
    }

    setIsSending(true);
    try {
      const { data } = await axiosInstance.post('/notifications/send', {
        targetUserId: targetUser === 'all' ? 'all' : parseInt(targetUser, 10),
        title,
        message,
        type,
      });
      if (data.success) {
        toast.success('Message sent successfully!');
        setTitle('');
        setMessage('');
        onClose();
      } else {
        toast.error('Failed to send message: ' + data.error);
      }
    } catch (error) {
      toast.error(error.response ? 'Failed to send message: ' + error.response.data?.error : 'Error connecting to server');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={Boolean(isOpen)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        className="tw:w-[450px] tw:overflow-hidden tw:rounded-2xl tw:sm:max-w-[calc(100%-2rem)]"
      >
        <DialogHeader className={cn('tw:flex-row tw:items-center tw:justify-between tw:gap-2.5 tw:border-0 tw:p-6 tw:text-white', tone.toneClass)}>
          <div className="tw:flex tw:items-center tw:gap-2.5">
            <span className="tw:flex tw:rounded-full tw:bg-white/20 tw:p-2"><Send className="tw:size-5" /></span>
            <div>
              <DialogTitle className="tw:text-xl tw:font-semibold tw:text-white">Broadcast Message</DialogTitle>
              <DialogDescription className="tw:text-[13px] tw:text-white/80">Send live alerts to users</DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}
            className="tw:size-8 tw:rounded-full tw:bg-black/10 tw:text-white tw:hover:bg-black/20 tw:[&_svg:not([class*=size-])]:size-5">
            <X />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSend} className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
          <DialogBody className="tw:gap-5 tw:p-6">
            <Field label={<><Users className="tw:size-3.5" /> Send To</>} layout="col" labelClassName={LABEL_CLASS}>
              <SelectBox
                options={targetOptions}
                value={targetUser}
                onValueChange={setTargetUser}
                placeholder={otherUsers.length ? 'Choose a user...' : 'No other user online'}
                className="tw:h-9 tw:w-full"
              />
            </Field>

            <div className="tw:flex tw:flex-col tw:gap-4 tw:sm:flex-row">
              <Field label={<><TypeIcon className={cn('tw:size-4', tone.iconClass)} /> Notification Type</>} layout="col"
                labelClassName={LABEL_CLASS} className="tw:flex-1">
                <SelectBox options={TYPE_OPTIONS} value={type} onValueChange={setType} className="tw:h-9 tw:w-full" />
              </Field>
              <Field label="Message Title" layout="col" labelClassName={LABEL_CLASS} className="tw:flex-2">
                <Input data-allow-text value={title} onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Server Maintenance" className="tw:h-9" />
              </Field>
            </div>

            <Field label="Message Details" layout="col" labelClassName={LABEL_CLASS}>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4}
                placeholder="Type your message here..." />
            </Field>
          </DialogBody>

          <DialogFooter className="tw:gap-3 tw:px-6 tw:py-4">
            <Button size="lg" onClick={onClose} className="tw:text-muted-foreground">Cancel</Button>
            <Button size="lg" variant="default" type="submit" disabled={isSending} className={cn('tw:border-0', tone.toneClass)}>
              <Send /> {isSending ? 'Sending...' : 'Broadcast'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';

// A refusal from the server lists its reasons on the form; a lost connection only has its own message.
export function showSaveFailure(error, setErrors) {
  if (error.response) {
    setErrors(error.response.data?.errors || [errorMessage(error)]);
    toast.error('Not saved - see the messages on the form');
  } else {
    setErrors([error.message]);
    toast.error(`Not saved: ${error.message}`);
  }
}

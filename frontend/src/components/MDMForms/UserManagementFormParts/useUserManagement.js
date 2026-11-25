import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import askConfirm from '@/components/common/askConfirm';
import { mastersFormApi } from '../masterKit/masterRecordsApi';
import usePermissions from './usePermissions';
import { EMPTY_USER_FORM, formFromUser, fullRow, permissionsFromUser } from './userFormData';

const MIN_PASSWORD = 8;

// the problem with the typed password pair, or ''
const passwordProblem = (password, confirmPassword) => {
  if (password !== confirmPassword) return 'Passwords do not match!';
  if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return '';
};

export default function useUserManagement() {
  const rights = usePermissions();
  const { catalog, permissions, setPermissions, handleSelectAll } = rights;

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_USER_FORM);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [branches, setBranches] = useState([]);
  // the user being worked on stays selected after a save / reload
  const selectedUserRef = useRef(null);
  const catalogRef = useRef(catalog);
  useEffect(() => { catalogRef.current = catalog; }, [catalog]);

  const setField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));

  const handleUserSelect = useCallback((user) => {
    setSelectedUser(user);
    selectedUserRef.current = user;
    // a password typed for one user must never be saved on the next one
    setPassword('');
    setConfirmPassword('');
    setFormData(formFromUser(user));
    setPermissions(permissionsFromUser(user, catalogRef.current));
  }, [setPermissions]);

  const fetchUsers = useCallback(async () => {
    try {
      const answer = await mastersFormApi.userList();
      const list = Array.isArray(answer) ? answer : [];
      setUsers(list);
      const keep = selectedUserRef.current && list.find((user) => user.id === selectedUserRef.current.id);
      if (keep) handleUserSelect(keep);
      else if (list.length > 0) handleUserSelect(list[0]);
    } catch (error) {
      console.error(error);
    }
  }, [handleUserSelect]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const answer = await mastersFormApi.userCompanyBranches();
        if (!answer?.success || !answer.data) return;
        setBranches(answer.data);
        if (answer.data.length > 0) setFormData((current) => (current.branch === '' ? { ...current, branch: answer.data[0].branchCode } : current));
      } catch (error) {
        console.error('Failed to load branches', error);
      }
    };
    loadBranches();
  }, []);

  const handleSave = async () => {
    if (!formData.username?.trim()) return toast.error('User ID is required.');
    if (!formData.fullName?.trim()) return toast.error('Full Name is required.');

    const permissionRows = Object.keys(permissions).map((moduleName) => ({ moduleName, ...permissions[moduleName] }));
    const payload = { ...formData, username: formData.username.trim().toUpperCase(), permissions: permissionRows };
    if (password || confirmPassword) {
      const problem = passwordProblem(password, confirmPassword);
      if (problem) return toast.error(problem);
      payload.password = password;
    }

    try {
      if (selectedUser) {
        await mastersFormApi.userUpdate(selectedUser.id, payload);
        toast.success('User details updated successfully!');
      } else {
        if (!payload.password) return toast.error('Password is required when creating a new user.');
        const created = await mastersFormApi.userCreate(payload);
        if (created?.id) selectedUserRef.current = created;
        toast.success('New user created successfully!');
      }
      setPassword('');
      setConfirmPassword('');
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to save user details. Please try again.');
    }
  };

  const saveRef = useRef(handleSave);
  useEffect(() => { saveRef.current = handleSave; });
  useEffect(() => {
    const saveOnF7 = (event) => {
      if (event.key !== 'F7') return;
      event.preventDefault();
      saveRef.current();
    };
    window.addEventListener('keydown', saveOnF7);
    return () => window.removeEventListener('keydown', saveOnF7);
  }, []);

  const handlePasswordReset = async () => {
    if (!selectedUser) return toast.error('Please select a user first');
    if (!password) return toast.error('Please enter a new password');
    const problem = passwordProblem(password, confirmPassword);
    if (problem) return toast.error(problem);
    try {
      await mastersFormApi.userUpdate(selectedUser.id, { password });
      toast.success(`Password updated successfully for ${selectedUser.username}`);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Error updating password');
      console.error(error);
    }
  };

  const changeStatus = async ({ status, done, failed }) => {
    try {
      await mastersFormApi.userUpdate(selectedUser.id, { status });
      toast.success(done);
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error(failed(error));
    }
  };

  const confirmStatus = async ({ verb, status, done, failed }) => {
    if (!selectedUser) return toast.error(`Please select a user to ${verb}.`);
    const confirmed = await askConfirm({ title: 'Confirm Action', message: `Are you sure you want to ${verb} ${selectedUser.username}?`, okLabel: 'Yes, Proceed', cancelLabel: 'Cancel' });
    if (confirmed) changeStatus({ status, done, failed: () => failed });
  };

  const handleDisableUser = () => confirmStatus({ verb: 'disable', status: 'inactive', done: 'User disabled successfully!', failed: 'Failed to disable user' });
  const handleLockUser = () => confirmStatus({ verb: 'lock', status: 'locked', done: 'User locked successfully!', failed: 'Failed to lock user' });
  // a disabled / locked user can be switched on again
  const handleEnableUser = () => {
    if (!selectedUser) return toast.error('Please select a user.');
    changeStatus({ status: 'active', done: 'User enabled successfully!', failed: (error) => error.response?.data?.error || 'Failed to enable user' });
  };

  const handleClear = () => {
    setSelectedUser(null);
    selectedUserRef.current = null;
    setFormData(EMPTY_USER_FORM);
    setPermissions({});
    setPassword('');
    setConfirmPassword('');
  };

  const handleAdminToggle = (isChecked) => {
    setField('role', isChecked ? 'admin' : 'user');
    if (isChecked) handleSelectAll(true);
  };
  // Director = PO approver: he logs in, sees Purchase and approves / rejects / holds POs. Purchase (view) is ticked for
  // him, so his rights are limited to the ticked modules (with no rights saved a user opens everything).
  const handleDirectorToggle = (isChecked) => {
    setField('role', isChecked ? 'director' : 'user');
    if (isChecked) setPermissions((current) => ({ ...current, 'Purchase Management': { ...(current['Purchase Management'] || fullRow(false)), canView: true } }));
  };

  const searchText = userSearch.toUpperCase();
  const visibleUsers = users.filter((user) => !userSearch || `${user.username || ''} ${user.fullName || ''} ${user.email || ''}`.toUpperCase().includes(searchText));
  const savedRows = Array.isArray(selectedUser?.permissions) ? selectedUser.permissions.length : 0;

  return {
    ...rights,
    users: visibleUsers, selectedUser, handleUserSelect, userSearch, setUserSearch,
    formData, setField, branches, password, setPassword, confirmPassword, setConfirmPassword, savedRows,
    handleSave, handlePasswordReset, handleDisableUser, handleLockUser, handleEnableUser, handleClear,
    handleAdminToggle, handleDirectorToggle, handlePrint: () => window.print(),
  };
}

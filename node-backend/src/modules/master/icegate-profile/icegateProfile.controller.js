import * as icegateProfileService from './icegateProfile.service.js';

export async function listProfiles(req, res) {
  res.json({ success: true, data: await icegateProfileService.listProfiles() });
}

export async function createProfile(req, res) {
  res.json({ success: true, data: await icegateProfileService.createProfile(req.body) });
}

export async function updateProfile(req, res) {
  res.json({ success: true, data: await icegateProfileService.updateProfile(req.params.id, req.body) });
}

export async function deleteProfile(req, res) {
  await icegateProfileService.deleteProfile(req.params.id);
  res.json({ success: true });
}

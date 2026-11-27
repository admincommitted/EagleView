import * as stockService from './stock.service.js';

export async function generateAwbStock(req, res) {
  res.status(201).json(await stockService.generateAwbStock(req.body));
}

export async function reserveNextAwb(req, res) {
  res.json(await stockService.reserveNextAwb(req.params.prefix));
}

export async function listAwbStock(req, res) {
  res.json(await stockService.listAwbStock(req.query));
}

export async function listHawbStock(req, res) {
  res.json(await stockService.listHawbStock(req.query));
}

export async function generateHawbStock(req, res) {
  res.status(201).json(await stockService.generateHawbStock(req.body));
}

export async function unallocateStock(req, res) {
  res.json(await stockService.unallocateStock(req.body));
}

export async function voidStock(req, res) {
  res.json(await stockService.voidStock(req.body));
}

export async function deleteStock(req, res) {
  res.json(await stockService.deleteStock(req.body));
}

export async function verifyAwb(req, res) {
  res.json(await stockService.verifyAwb(req.params.awb));
}

export async function returnAwb(req, res) {
  res.json(await stockService.returnAwb(req.body));
}

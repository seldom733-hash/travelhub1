# Phase 4G: KOMPAS Hotel Calendar + Price Verification - Completion Report

**Date**: 2026-09-19
**Status**: COMPLETE

## Summary

Phase 4G fixed the KOMPAS hotel identity resolution problem that caused calendar and modal to show destination-wide prices instead of BYZANTIUM-specific prices.

## Root Cause

Phase 4F removed hotel identity from calendar queries which caused calendar to show destination-wide prices and modal to show other hotels' offers.

## Changes Made

### Backend
- **kompas.adapter.ts**: Hotel checkbox typeahead when hotelExternalId provided, route interceptor allows HOTELS=<id> through, MAX_PAGES 5->15, bestOfferRef.searchContext includes hotelExternalId+destination, refreshPrice/refreshAvailability pass hotelExternalId
- **public-supplier.controller.ts**: Search endpoint accepts hotelExternalId, hotel, tourIncValue, tourIncName

### Frontend
- **supplier-api.ts**: Added SupplierPriceCalendarEntryOffer type (flat price:number), added tourIncValue/tourIncName to SupplierPriceCalendarQuery and SupplierOffer, searchSupplierOffers forwards hotel identity
- **TourDetail.tsx**: buildCalendarQuery includes hotelExternalId, hotel, tourIncValue, tourIncName
- **MonthlyCalendar.tsx**: Removed auto-advance logic
- **OfferModal.tsx**: Updated to SupplierPriceCalendarEntryOffer type, handleVerifyPrice passes tourIncValue/tourIncName, price display uses offer.price (number)

## Verification Results

### Browser (Playwright)
- PDP loads with BYZANTIUM title + KOMPAS ID: 20064
- September calendar: 12 green cells with BYZANTIUM prices
- October calendar: 31 green cells with BYZANTIUM prices ($1,184-$1,407)
- Modal shows THE BYZANTIUM HOTEL 4*, correct price $1,319.00
- Verify price button visible, Create request hidden until verify

### API
- Price-calendar returns 31 BYZANTIUM-specific entries for October
- bestOfferRef.searchContext includes hotelExternalId=20064

### Tests
- Backend: 36/36 kompas.adapter.spec.ts pass
- Frontend: 881/882 pass (1 pre-existing formatPrice NBSP failure)
- Frontend typecheck: 0 errors

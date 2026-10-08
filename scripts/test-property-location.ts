import test from "node:test";
import assert from "node:assert/strict";
import { propertyLocationSchema, propertyMapUrl, locationLabel, countryName } from "../src/lib/property-location";
import { bookingToday, validMoveInDate, submitBooking, createBookingTicket } from "../src/lib/booking-requests";
import type { PrismaClient } from "../src/generated/prisma/client";
import { publicationProblems } from "../src/lib/landlord-onboarding-policy";
const location = { countryCode: "KE", city: "Juja", region: "Kiambu", postalCode: "", latitude: "", longitude: "", timeZone: "Africa/Nairobi" };
test("location validates country, real time zone and coordinate pair", () => {
  assert.equal(propertyLocationSchema.safeParse(location).success, true);
  for (const change of [{countryCode:"XX"},{timeZone:"Africa/Invalid"},{latitude:"-1.2"},{latitude:"91",longitude:"20"},{latitude:"20",longitude:"181"},{latitude:"NaN",longitude:"10"}]) {
    assert.equal(propertyLocationSchema.safeParse({...location,...change}).success,false);
  }
  const parsed=propertyLocationSchema.parse({...location,countryCode:"gb",latitude:"0",longitude:"0",timeZone:"Europe/London"});
  assert.equal(parsed.countryCode,"GB");assert.equal(parsed.latitude,0);assert.equal(parsed.longitude,0);
});
test("address search is labeled separately from exact coordinates; missing locations have no map",()=>{
  assert.equal(propertyMapUrl({name:"Unlocated",physicalAddress:"Main road"}),null);
  assert.match(propertyMapUrl({name:"A & B",...location,physicalAddress:"Main road",latitude:null,longitude:null})!,/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.match(propertyMapUrl({name:"Origin",latitude:0,longitude:0})!,/query=0%2C0$/);
  assert.equal(countryName("XX"),"");assert.match(locationLabel({countryCode:"JP",city:"Tokyo"}),/Tokyo, Japan/);
});
test("bookings use property date across international date line and daylight saving",()=>{
  const now=new Date("2026-10-08T10:30:00Z");
  assert.equal(bookingToday("Pacific/Kiritimati",now),"2026-10-09");
  assert.equal(bookingToday("Pacific/Honolulu",now),"2026-10-08");
  assert.equal(validMoveInDate("2026-10-08",now,"Pacific/Kiritimati"),false);
  assert.equal(validMoveInDate("2026-10-08",now,"Pacific/Honolulu"),true);
  assert.equal(bookingToday("Europe/London",new Date("2026-06-01T23:30:00Z")),"2026-06-02");
  assert.equal(bookingToday("Europe/London",new Date("2026-12-01T23:30:00Z")),"2026-12-01");
  assert.equal(bookingToday("Invalid",now),"2026-10-08");
});
test("past property-local move-in is rejected before any booking write",async()=>{
  process.env.SESSION_SECRET="isolated-location-verification-secret";
  const now=new Date("2026-10-08T10:30:00Z");
  const database={$transaction:async()=>{throw Error("must not persist");}} as unknown as PrismaClient;
  const result=await submitBooking(database,{id:"test",organizationId:"org",timeZone:"Pacific/Kiritimati"},{fullName:"Test Student",phone:"+12025550123",email:"",roomTypeId:"room",preferredMoveIn:"2026-10-08",consent:true},createBookingTicket("test",now),now);
  assert.ok(result.error);
});
test("publication requires country, city and timezone without defaulting to Kenya",()=>{
  const property={name:"Tokyo Hostel",physicalAddress:"Test street",phone:"+81312345678",publicDescription:"Student rooms",customDomain:"tokyo.studentshostels.com",countryCode:"JP",city:"Tokyo",timeZone:"Asia/Tokyo"};
  assert.deepEqual(publicationProblems(property,1),[]);
  assert.equal(publicationProblems({...property,countryCode:null,city:null,timeZone:null},1).length,3);
});

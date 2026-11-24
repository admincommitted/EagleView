import React, { useEffect, useState } from 'react';
import { getMaster } from '../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026

const SharedDataLists = () => {
    const [airports, setAirports] = useState([]);
    const [airlines, setAirlines] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [countries, setCountries] = useState([]);
    const [iataAgents, setIataAgents] = useState([]);
    
    useEffect(() => {
        fetch('/api/locations/airports').then(res => res.json()).then(data => {
            if (Array.isArray(data)) setAirports(data);
        }).catch(err => console.error(err));
        
        getMaster('/api/masters/airlines').then(data => {
            if (Array.isArray(data)) setAirlines(data);
        }).catch(err => console.error(err));
        
        getMaster('/api/masters/currencies').then(data => {
            if (Array.isArray(data)) setCurrencies(data);
        }).catch(err => console.error(err));
        
        getMaster('/api/masters/countries').then(data => {
            if (Array.isArray(data)) setCountries(data);
        }).catch(err => console.error(err));

        getMaster('/api/masters/iataagents').then(data => {
            if (Array.isArray(data)) setIataAgents(data);
        }).catch(err => console.error(err));
    }, []);

    return (
        <>
            <datalist id="airport-code-list">
                {airports.map(apt => (
                    <option key={apt.id || apt.code} value={apt.iataCode || apt.code}>
                        {apt.cityName || apt.name} - {apt.airportName || apt.name}
                    </option>
                ))}
            </datalist>
            <datalist id="airline-code-list">
                {airlines.map(al => (
                    <option key={al.id || al.code} value={al.code}>
                        {al.name}
                    </option>
                ))}
            </datalist>
            <datalist id="airline-list">
                {airlines.map(al => (
                    <option key={`full-${al.id || al.code}`} value={al.name}>
                        {al.code} - {al.prefix}
                    </option>
                ))}
            </datalist>
            <datalist id="currency-list">
                {currencies.map(c => (
                    <option key={c.id || c.code} value={c.code}>
                        {c.name}
                    </option>
                ))}
            </datalist>
            <datalist id="country-list">
                {countries.map(c => (
                    <option key={c.id || c.code} value={c.code}>
                        {c.name}
                    </option>
                ))}
            </datalist>
            <datalist id="iata-agent-list">
                {iataAgents.map(i => (
                    <option key={i.id || i.code} value={i.code}>
                        {i.name} - {i.city}
                    </option>
                ))}
            </datalist>
        </>
    );
};

export default SharedDataLists;

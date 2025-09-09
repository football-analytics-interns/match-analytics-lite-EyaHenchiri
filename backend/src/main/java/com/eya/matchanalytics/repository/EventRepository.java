package com.eya.matchanalytics.repository;

import com.eya.matchanalytics.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<Event, Long> { }

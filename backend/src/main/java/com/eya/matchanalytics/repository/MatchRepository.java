package com.eya.matchanalytics.repository;

import com.eya.matchanalytics.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchRepository extends JpaRepository<Match, Long> { }
